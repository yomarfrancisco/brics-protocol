import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Contract, Signer } from "ethers";

describe("Redemption Queue View", function () {
  let config: Contract;
  let facade: Contract;
  let oracle: Contract;
  let adapter: Contract;
  let queueView: Contract;
  let deployer: Signer;
  let gov: Signer;
  let user: Signer;

  const trancheId = 1;
  const account = "0x1234567890123456789012345678901234567890";
  const FLAG_RISK_HIGH = 0x0001;
  const FLAG_SIZE_LARGE = 0x0002;
  const FLAG_AGE_OLD = 0x0004;
  const FLAG_CAP_PRESSURE = 0x0008;

  beforeEach(async function () {
    [deployer, gov, user] = await ethers.getSigners();

    // Deploy mock oracle
    const MockOracle = await ethers.getContractFactory("MockTrancheRiskOracle");
    oracle = await MockOracle.deploy();

    // Deploy TrancheRiskOracleAdapter
    const TrancheRiskOracleAdapter = await ethers.getContractFactory("TrancheRiskOracleAdapter");
    adapter = await TrancheRiskOracleAdapter.deploy(
      await oracle.getAddress(),
      3600 // 1 hour max age
    );

    // Deploy ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    config = await ConfigRegistry.deploy(await gov.getAddress());

    // Deploy TrancheReadFacade
    const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
    facade = await TrancheReadFacade.deploy(
      await oracle.getAddress(),
      await config.getAddress(),
      await adapter.getAddress(),
      true // enableTrancheRisk
    );

    // Deploy RedemptionQueueView
    const RedemptionQueueView = await ethers.getContractFactory("RedemptionQueueView");
    queueView = await RedemptionQueueView.deploy(
      await facade.getAddress(),
      await config.getAddress()
    );

    // Set up mock data
    await oracle.setTrancheRisk(trancheId, 500, 200);
  });

  describe("Happy Paths", function () {
    it("should compute priority score with default weights", async function () {
      const amount = 10000e6; // 10,000 USDC
      const requestTime = await time.latest();
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(priorityScore).to.be.gt(0);
      expect(reasonBits).to.be.gte(0);
      expect(riskComponent).to.be.gte(0);
      expect(ageComponent).to.equal(0); // No age boost for immediate request
      expect(sizeComponent).to.be.gte(0);
    });

    it("should compute higher priority for older requests", async function () {
      const amount = 10000e6; // 10,000 USDC
      const requestTime = 1704067200 - 30 * 24 * 3600; // 30 days ago
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(ageComponent).to.be.gt(0);
      expect(reasonBits & FLAG_AGE_OLD).to.be.gt(0);
    });

    it("should compute higher priority for larger amounts", async function () {
      const amount = 100000e6; // 100,000 USDC (above 10k threshold)
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(sizeComponent).to.be.gt(0);
      expect(reasonBits & FLAG_SIZE_LARGE).to.be.gt(0);
    });

    it("should compute higher priority for higher risk", async function () {
      // Set high risk adjustment
      await config.connect(gov).setTrancheRiskAdjOverrideBps(trancheId, 3000); // 30%
      
      const amount = 10000e6; // 10,000 USDC
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(riskComponent).to.be.gt(0);
      expect(reasonBits & FLAG_RISK_HIGH).to.be.gt(0);
    });

    it("should show monotonic score increases", async function () {
      const requestTime = 1704067200; // Fixed timestamp for testing
      const baseAmount = 10000e6;
      
      // Test with different amounts
      const [score1] = await queueView.computePriorityScore(trancheId, account, baseAmount, requestTime);
      const [score2] = await queueView.computePriorityScore(trancheId, account, baseAmount * 2, requestTime);
      const [score3] = await queueView.computePriorityScore(trancheId, account, baseAmount * 5, requestTime);
      
      expect(score2).to.be.gte(score1);
      expect(score3).to.be.gte(score2);
    });
  });

  describe("Bounds and Edge Cases", function () {
    it("should handle zero weights", async function () {
      await config.connect(gov).setRedemptionWeights(0, 0, 0);
      
      const amount = 10000e6;
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(priorityScore).to.equal(0);
    });

    it("should handle maximum weights", async function () {
      await config.connect(gov).setRedemptionWeights(10000, 0, 0); // 100% risk weight
      
      const amount = 10000e6;
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(priorityScore).to.be.gt(0);
    });

    it("should reject invalid weight sums", async function () {
      await expect(
        config.connect(gov).setRedemptionWeights(6000, 3000, 2000) // Sum > 10000
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should reject invalid individual weights", async function () {
      await expect(
        config.connect(gov).setRedemptionWeights(11000, 0, 0) // > 10000
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should handle zero amount", async function () {
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, 0, requestTime);
      
      expect(sizeComponent).to.equal(0);
      expect(reasonBits & FLAG_SIZE_LARGE).to.equal(0);
    });

    it("should handle future request timestamps", async function () {
      const amount = 10000e6;
      const requestTime = 1704067200 + 24 * 3600; // 1 day in future
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(ageComponent).to.equal(0);
      expect(reasonBits & FLAG_AGE_OLD).to.equal(0);
    });

    it("should cap age component at maximum", async function () {
      const amount = 10000e6;
      const requestTime = 1704067200 - 400 * 24 * 3600; // 400 days ago (beyond 365 cap)
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(ageComponent).to.be.lte(10000);
    });

    it("should cap size component at maximum", async function () {
      const amount = 200000e6; // 200k USDC (beyond 10x threshold)
      const requestTime = await time.latest();
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(sizeComponent).to.be.lte(10000);
    });
  });

  describe("Governance Controls", function () {
    it("should only allow GOV_ROLE to set weights", async function () {
      await expect(
        config.connect(user).setRedemptionWeights(4000, 3000, 3000)
      ).to.be.revertedWithCustomError(config, "AccessControlUnauthorizedAccount");
    });

    it("should only allow GOV_ROLE to set thresholds", async function () {
      await expect(
        config.connect(user).setRedemptionThresholds(7, 10000)
      ).to.be.revertedWithCustomError(config, "AccessControlUnauthorizedAccount");
    });

    it("should validate threshold bounds", async function () {
      await expect(
        config.connect(gov).setRedemptionThresholds(400, 1000001) // > 365 days
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should emit events on weight changes", async function () {
      await expect(
        config.connect(gov).setRedemptionWeights(5000, 3000, 2000)
      ).to.emit(config, "RedemptionWeightsSet")
        .withArgs(5000, 3000, 2000);
    });

    it("should emit events on threshold changes", async function () {
      await expect(
        config.connect(gov).setRedemptionThresholds(14, 50000)
      ).to.emit(config, "RedemptionThresholdsSet")
        .withArgs(14, 50000);
    });
  });

  describe("Telemetry Parity", function () {
    it("should align reason bits with inputs", async function () {
      const amount = 50000e6; // 50k USDC (above threshold)
      const requestTime = 1704067200 - 14 * 24 * 3600; // 14 days ago
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      // Should have size and age flags
      expect(reasonBits & FLAG_SIZE_LARGE).to.be.gt(0);
      expect(reasonBits & FLAG_AGE_OLD).to.be.gt(0);
    });

    it("should handle multiple reason flags", async function () {
      // Set high risk
      await config.connect(gov).setTrancheRiskAdjOverrideBps(trancheId, 3000);
      
      const amount = 100000e6; // 100k USDC
      const requestTime = 1704067200 - 30 * 24 * 3600; // 30 days ago
      
      const [priorityScore, reasonBits, riskComponent, ageComponent, sizeComponent] = 
        await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      // Should have all three flags
      expect(reasonBits & FLAG_RISK_HIGH).to.be.gt(0);
      expect(reasonBits & FLAG_SIZE_LARGE).to.be.gt(0);
      expect(reasonBits & FLAG_AGE_OLD).to.be.gt(0);
    });
  });

  describe("Configuration Views", function () {
    it("should return correct redemption weights", async function () {
      const [riskWeight, ageWeight, sizeWeight] = await config.getRedemptionWeights();
      expect(riskWeight).to.equal(4000); // 40%
      expect(ageWeight).to.equal(3000);  // 30%
      expect(sizeWeight).to.equal(3000); // 30%
    });

    it("should return correct redemption thresholds", async function () {
      const [minAgeDays, sizeThreshold] = await config.getRedemptionThresholds();
      expect(minAgeDays).to.equal(7);
      expect(sizeThreshold).to.equal(10000);
    });

    it("should return correct queue view configuration", async function () {
      const [riskWeight, ageWeight, sizeWeight, minAgeDays, sizeThreshold] = 
        await queueView.getRedemptionConfig();
      
      expect(riskWeight).to.equal(4000);
      expect(ageWeight).to.equal(3000);
      expect(sizeWeight).to.equal(3000);
      expect(minAgeDays).to.equal(7);
      expect(sizeThreshold).to.equal(10000);
    });
  });

  describe("Deterministic Behavior", function () {
    it("should return same score for same inputs", async function () {
      const amount = 10000e6;
      const requestTime = 1704067200; // Fixed timestamp for testing
      
      const [score1] = await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      const [score2] = await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      
      expect(score1).to.equal(score2);
    });

    it("should handle different accounts with same parameters", async function () {
      const amount = 10000e6;
      const requestTime = 1704067200; // Fixed timestamp for testing
      const account2 = "0x2345678901234567890123456789012345678901";
      
      const [score1] = await queueView.computePriorityScore(trancheId, account, amount, requestTime);
      const [score2] = await queueView.computePriorityScore(trancheId, account2, amount, requestTime);
      
      expect(score1).to.equal(score2); // Account should not affect score
    });
  });
});
