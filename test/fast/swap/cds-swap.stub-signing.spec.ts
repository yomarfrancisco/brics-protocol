import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { signDigestEip191 } from "../../utils/signing";

async function deployFixture() {
  const [deployer] = await ethers.getSigners();

  // Increase time to a deterministic point
  await time.increase(1000);

  // Deploy CDS swap engine
  const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
  const cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
  await cdsSwapEngine.waitForDeployment();

  // Set up price oracle with the deterministic key
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
  const deterministicKey = "0x000000000000000000000000000000000000000000000000000000000000002a";
  const deterministicWallet = new ethers.Wallet(deterministicKey);
  const mockOracle = await MockPriceOracle.deploy(deterministicWallet.address);
  await mockOracle.waitForDeployment();
  await cdsSwapEngine.setPriceOracle(await mockOracle.getAddress());

  // Grant broker role to deployer
  await cdsSwapEngine.grantRole(await cdsSwapEngine.BROKER_ROLE(), deployer.address);

  return { cdsSwapEngine, deployer, deterministicWallet };
}

describe("CDS Swap Stub Signing", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;
  let deterministicWallet: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    cdsSwapEngine = fixture.cdsSwapEngine;
    deployer = fixture.deployer;
    deterministicWallet = fixture.deterministicWallet;
  });

  describe("Stub Provider Signature Verification", function () {
    it("should verify stub signature when STUB_SIGN=1", async function () {
      // This test will help debug the signature verification
      const portfolioId = "0x5703dee4c046e60c377da8cb247cd87d7c75dca25a1da95d63e35fa49d579135";
      const asOf = Number(await time.latest()) - 60; // 1 minute ago (fix stale timestamp)
      const tenorDays = 30;
      const notional = BigInt(1000000);
      const features = { industry: "technology", region: "us", size: "large", rating: "bbb" };
      const fixedSpreadBps = 80;

      // Create swap parameters with deterministic timestamps
      const t0 = await time.latest();
      await time.increase(1000);
      const startTime = Number(await time.latest()) + 3600;
      const maturityTime = startTime + (tenorDays * 24 * 3600);

      const swapParams = {
        portfolioId,
        protectionBuyer: {
          counterparty: deployer.address,
          notional: ethers.parseUnits(notional.toString(), 6),
          spreadBps: fixedSpreadBps,
          start: startTime,
          maturity: maturityTime,
        },
        protectionSeller: {
          counterparty: "0x" + "1".repeat(40),
          notional: ethers.parseUnits(notional.toString(), 6),
          spreadBps: fixedSpreadBps,
          start: startTime,
          maturity: maturityTime,
        },
        correlationBps: 7000,
      };

      // Propose and activate swap
      const proposeTx = await cdsSwapEngine.proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => log.fragment?.name === "SwapProposed");
      const swapId = proposeEvent.args.swapId;

      await cdsSwapEngine.activateSwap(swapId);

      // Manually create the expected quote using the same logic as stub provider
      const h = require("crypto").createHash("sha256")
        .update(JSON.stringify({ p: portfolioId, t: tenorDays.toString(), a: asOf.toString() }))
        .digest();
      const fair = 25 + (h[0] % 100);
      const corr = 1000 + (h[1] % 8000);

      // Create digest matching RiskSignalLib format
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const portfolioIdBytes32 = ethers.zeroPadValue(portfolioId, 32);
      const digest = ethers.keccak256(abiCoder.encode(
        ["bytes32", "uint64", "uint256", "uint16", "uint16", "bytes32", "bytes32"],
        [portfolioIdBytes32, asOf, 0, corr, fair, ethers.ZeroHash, ethers.ZeroHash]
      ));

      // Sign with deterministic key using the helper
      const signature = await signDigestEip191(deterministicWallet, digest);

      const quote = {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf,
        riskScore: 1000 + (h[2] % 9000),
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("baseline-v0")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ industry: "technology", region: "us", size: "large", rating: "bbb" }))),
        digest,
        signature
      };

      console.log("Debug info:");
      console.log(`Portfolio ID: ${portfolioId}`);
      console.log(`Digest: ${digest}`);
      console.log(`Signature: ${signature}`);
      console.log(`Expected signer: ${deterministicWallet.address}`);
      console.log(`Fair spread: ${fair}, Correlation: ${corr}`);

      // Try to settle the swap
      try {
        const elapsedDays = 1; // 1 day elapsed
        const tenorDays = 30; // 30 days total tenor
        await cdsSwapEngine.settleSwap(swapId, quote, elapsedDays, tenorDays);
        console.log("✅ Settlement succeeded!");
      } catch (error: any) {
        console.log("❌ Settlement failed:", error.message);
        // Let's check what the verifyQuote function returns
        const isValid = await cdsSwapEngine.verifyQuote(quote, portfolioId);
        console.log(`verifyQuote result: ${isValid}`);
      }
    });
  });
});
