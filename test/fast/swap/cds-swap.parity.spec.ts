import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { signDigestEip191 } from "../../utils/signing";

describe("CDS Swap Parity Test", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy CDS swap engine
    const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
    cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
    await cdsSwapEngine.waitForDeployment();

    // Set up price oracle with the deterministic key
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const deterministicKey = "0x000000000000000000000000000000000000000000000000000000000000002a";
    const deterministicWallet = new ethers.Wallet(deterministicKey);
    const mockOracle = await MockPriceOracle.deploy(deterministicWallet.address);
    await mockOracle.waitForDeployment();
    await cdsSwapEngine.setPriceOracle(await mockOracle.getAddress());
  });

  it("should verify quote signature and print recovered address", async function () {
    const portfolioId = "0x5703dee4c046e60c377da8cb247cd87d7c75dca25a1da95d63e35fa49d579135";
    const asOf = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const deterministicKey = "0x000000000000000000000000000000000000000000000000000000000000002a";
    const wallet = new ethers.Wallet(deterministicKey);

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
    const signature = await signDigestEip191(wallet, digest);

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

    // Test verifyQuote directly
    const isValid = await cdsSwapEngine.verifyQuote(quote, portfolioId);
    
    console.log("Parity Test Results:");
    console.log(`Expected signer: ${wallet.address}`);
    console.log(`Quote valid: ${isValid}`);
    console.log(`Fair spread: ${fair}, Correlation: ${corr}, Risk score: ${riskScore}`);
    console.log(`Digest: ${digest}`);
    console.log(`Signature: ${signature.slice(0, 20)}...`);
    
    // The function should return true if the signature is valid
    expect(isValid).to.be.true;
  });
});
