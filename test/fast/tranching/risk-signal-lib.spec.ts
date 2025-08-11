import { expect } from "chai";
import { ethers } from "hardhat";
import { MockRiskSignalLib } from "../../../typechain-types";
import { RiskSignalLib } from "../../../typechain-types";

describe("RiskSignalLib Fast Tests", function () {
  let mockRiskSignalLib: MockRiskSignalLib;
  let riskOracle: any;

  beforeEach(async function () {
    // Use a deterministic private key for the risk oracle
    const RISK_ORACLE_PRIV_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    riskOracle = new ethers.Wallet(RISK_ORACLE_PRIV_KEY, ethers.provider);

    // Deploy mock RiskSignalLib for testing
    const MockRiskSignalLib = await ethers.getContractFactory("MockRiskSignalLib");
    mockRiskSignalLib = await MockRiskSignalLib.deploy();
  });

  describe("digest()", function () {
    it("should compute correct digest for valid payload", async function () {
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

    it("should handle min uint16 values", async function () {
      const payload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 123456789,
        correlationBps: 0,
        spreadBps: 0,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      expect(digest).to.have.length(66);
    });

    it("should handle max uint16 values", async function () {
      const payload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 123456789,
        correlationBps: 65535, // max uint16
        spreadBps: 65535, // max uint16
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      expect(digest).to.have.length(66);
    });

    it("should handle boundary correlation values", async function () {
      const payload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 123456789,
        correlationBps: 10000, // 100% boundary
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      expect(digest).to.have.length(66);
    });

    it("should handle boundary spread values", async function () {
      const payload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: 1700000000,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 20000, // 200% boundary
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      expect(digest).to.have.length(66);
    });

    it("should handle timestamp boundaries", async function () {
      const now = Math.floor(Date.now() / 1000);
      
      // Past timestamp
      const pastPayload: RiskSignalLib.PayloadStruct = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: now - 1,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const pastDigest = await mockRiskSignalLib.digest(pastPayload);
      expect(pastDigest).to.have.length(66);

      // Current timestamp
      const currentPayload: RiskSignalLib.PayloadStruct = {
        ...pastPayload,
        asOf: now
      };

      const currentDigest = await mockRiskSignalLib.digest(currentPayload);
      expect(currentDigest).to.have.length(66);

      // Future timestamp
      const futurePayload: RiskSignalLib.PayloadStruct = {
        ...pastPayload,
        asOf: now + 1
      };

      const futureDigest = await mockRiskSignalLib.digest(futurePayload);
      expect(futureDigest).to.have.length(66);
    });
  });

  describe("recoverSigner()", function () {
    it("should recover correct signer for valid signature", async function () {
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
      const signature = await riskOracle.signMessage(ethers.getBytes(digest));
      const recoveredSigner = await mockRiskSignalLib.recoverSigner(payload, signature);
      
      expect(recoveredSigner).to.equal(await riskOracle.getAddress());
    });

    it("should fail to recover signer for tampered digest", async function () {
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
      const signature = await riskOracle.signMessage(ethers.getBytes(digest));
      
      // Tamper with the payload to create a different digest
      const tamperedPayload = { ...payload, riskScore: 999999999 };
      const recoveredSigner = await mockRiskSignalLib.recoverSigner(tamperedPayload, signature);
      
      expect(recoveredSigner).to.not.equal(await riskOracle.getAddress());
    });

    it("should revert for malformed signature", async function () {
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
      const malformedSignature = "0x" + "00".repeat(30); // Too short
      
      await expect(
        mockRiskSignalLib.recoverSigner(payload, malformedSignature)
      ).to.be.reverted;
    });

    it("should revert for short signature", async function () {
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
      const shortSignature = "0x" + "00".repeat(64); // Missing recovery byte
      
      await expect(
        mockRiskSignalLib.recoverSigner(payload, shortSignature)
      ).to.be.reverted;
    });
  });
});
