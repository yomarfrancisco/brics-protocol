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

  return { cdsSwapEngine, deployer, deterministicWallet };
}

describe("CDS Swap Verify Quote", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;
  let deterministicWallet: ethers.Wallet;

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    cdsSwapEngine = fixture.cdsSwapEngine;
    deployer = fixture.deployer;
    deterministicWallet = fixture.deterministicWallet;
  });

  describe("verifyQuote", function () {
    it("should verify quote signature correctly", async function () {
      const portfolioId = "0x5703dee4c046e60c377da8cb247cd87d7c75dca25a1da95d63e35fa49d579135";
      const t0 = await time.latest();
      await time.increase(1000);
      const asOf = Number(await time.latest()) - 60; // 1 minute ago from current time

      // Create deterministic values
      const h = require("crypto").createHash("sha256")
        .update(JSON.stringify({ p: portfolioId, t: "30", a: asOf.toString() }))
        .digest();
      const fair = 25 + (h[0] % 100);
      const corr = 1000 + (h[1] % 8000);
      const riskScore = 1000 + (h[2] % 9000);

      // Create digest matching RiskSignalLib format
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const portfolioIdBytes32 = ethers.zeroPadValue(portfolioId, 32);
      const modelIdHash = ethers.keccak256(ethers.toUtf8Bytes("baseline-v0"));
      const featuresHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ industry: "technology", region: "us", size: "large", rating: "bbb" })));

      const digest = ethers.keccak256(abiCoder.encode(
        ["bytes32", "uint64", "uint256", "uint16", "uint16", "bytes32", "bytes32"],
        [portfolioIdBytes32, asOf, riskScore, corr, fair, modelIdHash, featuresHash]
      ));

      // Sign the digest with EIP-191 prefix using the helper
      const signature = await signDigestEip191(deterministicWallet, digest);

      const quote = {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf,
        riskScore,
        modelIdHash,
        featuresHash,
        digest,
        signature
      };

      console.log("Test verifyQuote:");
      console.log(`Portfolio ID: ${portfolioId}`);
      console.log(`Expected signer: ${deterministicWallet.address}`);
      console.log(`Fair spread: ${fair}, Correlation: ${corr}, Risk score: ${riskScore}`);

      // Test verifyQuote directly
      const isValid = await cdsSwapEngine.verifyQuote(quote, portfolioId);
      console.log(`verifyQuote result: ${isValid}`);
      
      expect(isValid).to.be.true;
    });
  });
});
