import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("RedemptionQueueView", function () {
  let deployer: Signer, gov: Signer, user: Signer;
  let deployerAddr: string, govAddr: string, userAddr: string;
  
  let configRegistry: Contract;
  let trancheFacade: Contract;
  let redemptionQueueView: Contract;
  let mockOracle: Contract;
  let mockRiskAdapter: Contract;

  const TRANCHE_ID = 1;
  let FIXED_TIMESTAMP: number;
  beforeEach(async function () {
    [deployer, gov, user] = await ethers.getSigners();
    [deployerAddr, govAddr, userAddr] = await Promise.all([
      deployer.getAddress(), gov.getAddress(), user.getAddress()
    ]);

    // Deploy ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(govAddr);

    // Deploy mock oracle
    const MockTrancheRiskOracle = await ethers.getContractFactory("MockTrancheRiskOracle");
    mockOracle = await MockTrancheRiskOracle.deploy();

    // Deploy mock risk adapter
    const MockTrancheRiskOracleAdapter = await ethers.getContractFactory("MockTrancheRiskOracleAdapter");
    mockRiskAdapter = await MockTrancheRiskOracleAdapter.deploy();

    // Deploy TrancheReadFacade
    const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
    trancheFacade = await TrancheReadFacade.deploy(
      mockOracle,
      await configRegistry.getAddress(),
      mockRiskAdapter,
      true // enableTrancheRisk
    );

    // Deploy RedemptionQueueView
    const RedemptionQueueView = await ethers.getContractFactory("RedemptionQueueView");
    redemptionQueueView = await RedemptionQueueView.deploy(
      configRegistry,
      trancheFacade
    );

    // Get current timestamp
    const currentBlock = await ethers.provider.getBlock("latest");
    FIXED_TIMESTAMP = currentBlock!.timestamp + 86400; // Current time + 1 day

    // Set up mock oracle data
    await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 500, FIXED_TIMESTAMP); // 10% base, 5% risk adj
    
    // Set up mock risk adapter data (TrancheReadFacade uses adapter when enabled)
    await mockRiskAdapter.setRisk(TRANCHE_ID, 500, FIXED_TIMESTAMP); // 5% risk adj

    // Set deterministic timestamp
    await ethers.provider.send("evm_setNextBlockTimestamp", [FIXED_TIMESTAMP]);
    await ethers.provider.send("evm_mine", []);
  });

  describe("Basic Functionality", function () {
    it("should calculate priority score with default weights", async function () {
      const amount = ethers.parseEther("1000"); // 1000 tokens
      const asOf = FIXED_TIMESTAMP - 86400; // 1 day ago

      const [priorityScore, reasonBits, telemetryFlags, components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(priorityScore).to.be.gt(0);
      expect(reasonBits).to.be.gte(0);
      expect(telemetryFlags).to.be.gte(0);
      expect(components.riskScore).to.be.gt(0);
      expect(components.ageScore).to.be.gte(0);
      expect(components.sizeScore).to.be.gte(0);
      expect(components.totalScore).to.equal(priorityScore);
    });

    it("should return correct default weights", async function () {
      const [weightRisk, weightAge, weightSize] = await redemptionQueueView.getRedemptionWeights();
      expect(weightRisk).to.equal(3333);
      expect(weightAge).to.equal(3333);
      expect(weightSize).to.equal(3334);
    });

    it("should return correct default thresholds", async function () {
      const [minAgeDays, sizeBoostThreshold] = await redemptionQueueView.getRedemptionThresholds();
      expect(minAgeDays).to.equal(7);
      expect(sizeBoostThreshold).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Risk Score Calculation", function () {
    it("should calculate higher risk score for higher risk adjustment", async function () {
      // Set high risk adjustment
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 800, FIXED_TIMESTAMP); // 8% risk adj
      await mockRiskAdapter.setRisk(TRANCHE_ID, 800, FIXED_TIMESTAMP); // 8% risk adj

      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, , , components1] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // Set lower risk adjustment
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 200, FIXED_TIMESTAMP); // 2% risk adj
      await mockRiskAdapter.setRisk(TRANCHE_ID, 200, FIXED_TIMESTAMP); // 2% risk adj

      const [, , , components2] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // Higher risk should result in higher risk score
      expect(components1.riskScore).to.be.gt(components2.riskScore);
    });

    it("should set REASON_RISK_HIGH flag for high risk scores", async function () {
      // Set very high risk adjustment
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 3000, FIXED_TIMESTAMP); // 30% risk adj
      await mockRiskAdapter.setRisk(TRANCHE_ID, 3000, FIXED_TIMESTAMP); // 30% risk adj

      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, reasonBits] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(reasonBits & 0x0001n).to.equal(0x0001n); // REASON_RISK_HIGH
    });
  });

  describe("Age Score Calculation", function () {
    it("should return zero age score for recent requests", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - 86400; // 1 day ago (less than 7 days)

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.ageScore).to.equal(0);
    });

    it("should calculate age score for old requests", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (15 * 86400); // 15 days ago

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.ageScore).to.be.gt(0);
    });

    it("should cap age score at maximum", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (60 * 86400); // 60 days ago (beyond 30 day cap)

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.ageScore).to.equal(10000); // Should be capped at max
    });

    it("should set REASON_AGE_OLD flag for old requests", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (20 * 86400); // 20 days ago

      const [, reasonBits] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(reasonBits & 0x0004n).to.equal(0x0004n); // REASON_AGE_OLD
    });
  });

  describe("Size Score Calculation", function () {
    it("should return zero size score for small amounts", async function () {
      const amount = ethers.parseEther("500"); // Below 1000 token threshold
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.sizeScore).to.equal(0);
    });

    it("should calculate size score for large amounts", async function () {
      const amount = ethers.parseEther("10000"); // 10x threshold
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.sizeScore).to.be.gt(0);
    });

    it("should set REASON_SIZE_LARGE flag for large amounts", async function () {
      const amount = ethers.parseEther("1000000000"); // Very large amount (1000000x threshold)
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, reasonBits] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(reasonBits & 0x0002n).to.equal(0x0002n); // REASON_SIZE_LARGE
    });
  });

  describe("Configuration Integration", function () {
    it("should use custom weights when set", async function () {
      // Set custom weights
      await configRegistry.connect(gov).setRedemptionWeightRiskBps(5000); // 50%
      await configRegistry.connect(gov).setRedemptionWeightAgeBps(3000);  // 30%
      await configRegistry.connect(gov).setRedemptionWeightSizeBps(2000); // 20%

      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (10 * 86400); // 10 days ago

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // Risk should have higher weight (50%)
      expect(components.riskScore * 5000n).to.be.gt(components.ageScore * 3000n);
    });

    it("should use custom age threshold", async function () {
      // Set custom age threshold
      await configRegistry.connect(gov).setRedemptionMinAgeDays(3); // 3 days

      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (5 * 86400); // 5 days ago

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // Should have age score since 5 days > 3 days threshold
      expect(components.ageScore).to.be.gt(0);
    });

    it("should use custom size threshold", async function () {
      // Set custom size threshold
      await configRegistry.connect(gov).setRedemptionSizeBoostThreshold(ethers.parseEther("500")); // 500 tokens

      const amount = ethers.parseEther("1000"); // Above new threshold
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // Should have size score since 1000 > 500 threshold
      expect(components.sizeScore).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amount", async function () {
      const amount = 0;
      const asOf = FIXED_TIMESTAMP - 86400;

      const [priorityScore, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(priorityScore).to.be.gte(0);
      expect(components.sizeScore).to.equal(0);
    });

    it("should handle very old requests", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - (365 * 86400); // 1 year ago

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.ageScore).to.equal(10000); // Should be capped
    });

    it("should handle very large amounts", async function () {
      const amount = ethers.parseEther("1000000"); // 1M tokens
      const asOf = FIXED_TIMESTAMP - 86400;

      const [, , , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components.sizeScore).to.be.gt(0);
      expect(components.sizeScore).to.be.lte(10000); // Should be capped
    });

    it("should set REASON_CAP_PRESSURE for high priority scores", async function () {
      // Create conditions for very high priority score
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 4000, FIXED_TIMESTAMP); // Very high risk
      await mockRiskAdapter.setRisk(TRANCHE_ID, 4000, FIXED_TIMESTAMP); // Very high risk
      const amount = ethers.parseEther("100000000"); // Very large amount
      const asOf = FIXED_TIMESTAMP - (30 * 86400); // Very old request

      const [priorityScore, reasonBits, , components] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      console.log("Priority score:", priorityScore.toString());
      console.log("Components:", {
        riskScore: components.riskScore.toString(),
        ageScore: components.ageScore.toString(),
        sizeScore: components.sizeScore.toString()
      });

      expect(reasonBits & 0x0008n).to.equal(0x0008n); // REASON_CAP_PRESSURE
    });
  });

  describe("Deterministic Behavior", function () {
    it("should return same results for same inputs", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - 86400;

      const result1 = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      const result2 = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(result1[0]).to.equal(result2[0]); // priorityScore
      expect(result1[1]).to.equal(result2[1]); // reasonBits
      expect(result1[2]).to.equal(result2[2]); // telemetryFlags
    });

    it("should be monotonic with respect to risk", async function () {
      const amount = ethers.parseEther("1000");
      const asOf = FIXED_TIMESTAMP - 86400;

      // Low risk
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 100, FIXED_TIMESTAMP);
      await mockRiskAdapter.setRisk(TRANCHE_ID, 100, FIXED_TIMESTAMP);
      const [, , , components1] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      // High risk
      await mockOracle.setTrancheRiskWithTimestamp(TRANCHE_ID, 1000, 2000, FIXED_TIMESTAMP);
      await mockRiskAdapter.setRisk(TRANCHE_ID, 2000, FIXED_TIMESTAMP);
      const [, , , components2] = await redemptionQueueView.calculatePriorityScore(
        TRANCHE_ID,
        userAddr,
        amount,
        asOf
      );

      expect(components2.riskScore).to.be.gt(components1.riskScore);
    });
  });
});
