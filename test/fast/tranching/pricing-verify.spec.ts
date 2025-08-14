import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AdaptiveTranchingOracleAdapter } from "../../../typechain-types";
import { TrancheManagerV2 } from "../../../typechain-types";
import { MockRiskSignalLib } from "../../../typechain-types";
import { RiskSignalLib } from "../../../typechain-types";
import { signDigestEip191 } from "../../utils/signing";

describe("Pricing Verification Fast Tests", function () {
  let adapter: AdaptiveTranchingOracleAdapter;
  let trancheManager: TrancheManagerV2;
  let mockRiskSignalLib: MockRiskSignalLib;
  let gov: any;
  let oracle: any;
  let user: any;
  let riskOracle: any;

  beforeEach(async function () {
    [gov, oracle, user] = await ethers.getSigners();

    // Use a deterministic private key for the risk oracle
    const RISK_ORACLE_PRIV_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    riskOracle = new ethers.Wallet(RISK_ORACLE_PRIV_KEY, ethers.provider);

    // Deploy TrancheManagerV2
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      await gov.getAddress(),
      await gov.getAddress(), // mock oracle
      await gov.getAddress()  // mock config
    );

    // Deploy adapter with risk oracle
    const AdaptiveTranchingOracleAdapter = await ethers.getContractFactory("AdaptiveTranchingOracleAdapter");
    adapter = await AdaptiveTranchingOracleAdapter.deploy(
      await gov.getAddress(),
      await trancheManager.getAddress(),
      await riskOracle.getAddress()
    );

    // Grant ECC role to tranche manager
    await trancheManager.grantRole(await trancheManager.ECC_ROLE(), await gov.getAddress());

    // Deploy mock RiskSignalLib for testing
    const MockRiskSignalLib = await ethers.getContractFactory("MockRiskSignalLib");
    mockRiskSignalLib = await MockRiskSignalLib.deploy();
    
    // Set the risk oracle directly from the deterministic PK
    await adapter.setRiskOracle(await riskOracle.getAddress());
  });

  describe("RiskSignalLib", function () {
    it("should compute correct digest", async function () {
      const payload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      expect(digest).to.have.length(66); // 0x + 64 hex chars
    });
  });

  // Helper function to sign a payload with the current risk oracle
  async function signPayload(payload: RiskSignalLib.PayloadStruct) {
    const digest = await mockRiskSignalLib.digest(payload);
    const signature = await signDigestEip191(riskOracle, digest);
    
    // Guard assertion: verify the signature is valid
    const recovered = await mockRiskSignalLib.recoverSigner(payload, signature);
    expect(recovered).to.equal(await adapter.riskOracle());
    
    return signature;
  }

  describe("Signed Signal Submission", function () {
    let validPayload: RiskSignalLib.PayloadStruct;

    beforeEach(async function () {
      // Create a valid payload
      validPayload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60, // Use a timestamp 60 seconds in the past
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };
    });

    it("should accept valid signed signal", async function () {
      const signature = await signPayload(validPayload);
      await expect(adapter.submitSignedRiskSignal(validPayload, signature))
        .to.emit(adapter, "SignalCached");
    });

    it("should reject signal with wrong signer", async function () {
      const wrongSignature = await signDigestEip191(user, await mockRiskSignalLib.digest(validPayload));
      
      await expect(
        adapter.submitSignedRiskSignal(validPayload, wrongSignature)
      ).to.be.revertedWith("bad-signer");
    });

    it("should reject signal with invalid correlation", async function () {
      const invalidPayload = { ...validPayload, correlationBps: 10001 };
      const signature = await signPayload(invalidPayload);
      
      await expect(
        adapter.submitSignedRiskSignal(invalidPayload, signature)
      ).to.be.revertedWith("correlation > 100%");
    });

    it("should reject signal with invalid spread", async function () {
      const invalidPayload = { ...validPayload, spreadBps: 20001 };
      const signature = await signPayload(invalidPayload);
      
      await expect(
        adapter.submitSignedRiskSignal(invalidPayload, signature)
      ).to.be.revertedWith("spread > 200%");
    });

    it("should reject signal with future timestamp", async function () {
      // Get current block timestamp and add a large offset to ensure it's in the future
      const currentBlock = await ethers.provider.getBlock('latest');
      const futurePayload = { ...validPayload, asOf: currentBlock.timestamp + 86400 };
      const signature = await signPayload(futurePayload);
      
      await expect(
        adapter.submitSignedRiskSignal(futurePayload, signature)
      ).to.be.revertedWith("future timestamp");
    });

    it("should cache the signal correctly", async function () {
      const signature = await signPayload(validPayload);
      await adapter.submitSignedRiskSignal(validPayload, signature);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.corrPpm).to.equal(77700); // 777 bps * 100 = 77700 ppm
      expect(lastSignal.asOf).to.equal(validPayload.asOf);
    });
  });

  describe("Risk Oracle Management", function () {
    it("should allow admin to set risk oracle", async function () {
      const [_, __, ___, newOracle] = await ethers.getSigners();
      await adapter.setRiskOracle(await newOracle.getAddress());
      expect(await adapter.riskOracle()).to.equal(await newOracle.getAddress());
    });

    it("should reject non-admin setting risk oracle", async function () {
      const [_, __, ___, newOracle] = await ethers.getSigners();
      await expect(
        adapter.connect(user).setRiskOracle(await newOracle.getAddress())
      ).to.be.revertedWithCustomError(adapter, "AccessControlUnauthorizedAccount");
    });

    it("should reject zero address risk oracle", async function () {
      await expect(
        adapter.setRiskOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("oracle cannot be zero address");
    });
  });

  describe("Integration with Service", function () {
    it("should handle sample request from pricing service", async function () {
      // This test simulates the integration with the actual pricing service
      // In a real scenario, this would call the service and verify the response
      
      const samplePayload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 987654321,
        correlationBps: 2500,
        spreadBps: 1200,
        modelIdHash: "0x" + "aa".repeat(32),
        featuresHash: "0x" + "bb".repeat(32)
      };

      const signature = await signPayload(samplePayload);
      
      await expect(adapter.submitSignedRiskSignal(samplePayload, signature))
        .to.emit(adapter, "SignalCached");
    });
  });
});
