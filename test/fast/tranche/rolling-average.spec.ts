import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Rolling Average Risk Calculation", () => {
  let config: Contract;
  let oracle: Contract;
  let adapter: Contract;
  let facade: Contract;

  let owner: Signer;
  let ownerAddr: string;

  // Telemetry flag constants
  const FLAG_OVERRIDE_USED = 0x01;
  const FLAG_ADAPTER_USED = 0x02;
  const FLAG_ORACLE_DIRECT = 0x04;
  const FLAG_BANDS_ENABLED = 0x08;
  const FLAG_FLOOR_CLAMPED = 0x10;
  const FLAG_CEIL_CLAMPED = 0x20;
  const FLAG_ROLLING_AVG_ENABLED = 0x40;
  const FLAG_ROLLING_AVG_USED = 0x80;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();

    // Deploy ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    config = await ConfigRegistry.deploy(ownerAddr);

    // Deploy MockTrancheRiskOracle
    const MockTrancheRiskOracle = await ethers.getContractFactory("MockTrancheRiskOracle");
    oracle = await MockTrancheRiskOracle.deploy();

    // Deploy TrancheRiskOracleAdapter
    const TrancheRiskOracleAdapter = await ethers.getContractFactory("TrancheRiskOracleAdapter");
    adapter = await TrancheRiskOracleAdapter.deploy(
      await oracle.getAddress(),
      3600 // 1 hour max age
    );

    // Deploy TrancheReadFacade with adapter enabled
    const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
    facade = await TrancheReadFacade.deploy(
      await oracle.getAddress(),
      await config.getAddress(),
      await adapter.getAddress(),
      true // enableTrancheRisk
    );
  });

  describe("Basic Functionality", () => {
    it("should calculate simple average for single data point", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average with 7-day window
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record a single data point (different from oracle value to test rolling average)
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 250, timestamp); // Different from oracle's 200
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify rolling average is enabled and used
      expect(telemetry.rollingAverageBps).to.equal(250); // Should use recorded value
      expect(telemetry.rollingWindowDays).to.equal(7);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_ENABLED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.be.gt(0);
    });

    it("should calculate weighted average for multiple data points", async () => {
      const trancheId = 2;
      const baseApyBps = 900;
      const oracleRiskAdjBps = 300;
      
      // Enable rolling average with 7-day window
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record multiple data points with different timestamps
      const baseTime = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 200, Number(baseTime) - 6 * 24 * 3600); // 6 days ago
      await config.recordTrancheRiskPoint(trancheId, 250, Number(baseTime) - 3 * 24 * 3600); // 3 days ago
      await config.recordTrancheRiskPoint(trancheId, 300, Number(baseTime) - 1 * 24 * 3600); // 1 day ago
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify rolling average is calculated (should be weighted average)
      expect(telemetry.rollingAverageBps).to.be.gt(200);
      expect(telemetry.rollingAverageBps).to.be.lt(300);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_ENABLED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.be.gt(0);
    });

    it("should ignore data points outside window", async () => {
      const trancheId = 3;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average with 3-day window
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 3);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record data points with some outside window
      const baseTime = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 100, Number(baseTime) - 5 * 24 * 3600); // 5 days ago (outside)
      await config.recordTrancheRiskPoint(trancheId, 200, Number(baseTime) - 2 * 24 * 3600); // 2 days ago (inside)
      await config.recordTrancheRiskPoint(trancheId, 300, Number(baseTime) - 1 * 24 * 3600); // 1 day ago (inside)
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Should only consider points within 3-day window
      expect(telemetry.rollingAverageBps).to.be.gt(200);
      expect(telemetry.rollingAverageBps).to.be.lt(300);
    });

    it("should handle empty data gracefully", async () => {
      const trancheId = 4;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average but don't record any data points
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Should use raw oracle value when no rolling data available
      expect(telemetry.rollingAverageBps).to.equal(0);
      expect(telemetry.finalRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_ENABLED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.equal(0);
    });
  });

  describe("Governance Controls", () => {
    it("should respect window size changes", async () => {
      const trancheId = 5;
      
      // Set initial window
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      expect(await config.trancheRollingWindowDays(trancheId)).to.equal(7);
      
      // Change window size
      await config.setTrancheRollingWindow(trancheId, 14);
      expect(await config.trancheRollingWindowDays(trancheId)).to.equal(14);
    });

    it("should enable/disable per tranche", async () => {
      const trancheId = 6;
      
      // Initially disabled
      expect(await config.trancheRollingEnabled(trancheId)).to.be.false;
      
      // Enable
      await config.setTrancheRollingEnabled(trancheId, true);
      expect(await config.trancheRollingEnabled(trancheId)).to.be.true;
      
      // Disable
      await config.setTrancheRollingEnabled(trancheId, false);
      expect(await config.trancheRollingEnabled(trancheId)).to.be.false;
    });

    it("should validate parameter bounds", async () => {
      const trancheId = 7;
      
      // Test invalid window sizes
      await expect(config.setTrancheRollingWindow(trancheId, 0)).to.be.revertedWithCustomError(config, "BadParam");
      await expect(config.setTrancheRollingWindow(trancheId, 91)).to.be.revertedWithCustomError(config, "BadParam");
      
      // Test valid window sizes
      await expect(config.setTrancheRollingWindow(trancheId, 1)).to.not.be.reverted;
      await expect(config.setTrancheRollingWindow(trancheId, 90)).to.not.be.reverted;
    });

    it("should emit proper events", async () => {
      const trancheId = 8;
      
      // Test window set event
      await expect(config.setTrancheRollingWindow(trancheId, 7))
        .to.emit(config, "TrancheRollingWindowSet")
        .withArgs(trancheId, 0, 7);
      
      // Test enabled set event
      await expect(config.setTrancheRollingEnabled(trancheId, true))
        .to.emit(config, "TrancheRollingEnabledSet")
        .withArgs(trancheId, true);
      
      // Test data point event
      await config.setTrancheRollingEnabled(trancheId, true);
      const timestamp = await time.latest();
      await expect(config.recordTrancheRiskPoint(trancheId, 200, timestamp))
        .to.emit(config, "TrancheRollingPointAppended")
        .withArgs(trancheId, 200, timestamp);
    });
  });

  describe("Integration Precedence", () => {
    it("should work with overrides (override takes precedence)", async () => {
      const trancheId = 9;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 150;
      
      // Enable rolling average and set override
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Set oracle data and record rolling points
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, oracleRiskAdjBps, timestamp);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Override should take precedence over rolling average
      expect(telemetry.finalRiskAdjBps).to.equal(overrideRiskAdjBps);
      expect(Number(telemetry.telemetryFlags) & FLAG_OVERRIDE_USED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.equal(0);
    });

    it("should work with confidence bands", async () => {
      const trancheId = 10;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 500; // High risk
      
      // Enable rolling average and confidence bands
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      await config.setTrancheRiskBands(trancheId, 200, 400); // Floor 200, Ceiling 400
      
      // Set oracle data and record rolling points
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 450, timestamp); // Rolling average above ceiling
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Rolling average should be applied, then clamped by bands
      expect(telemetry.rollingAverageBps).to.equal(450);
      expect(telemetry.finalRiskAdjBps).to.equal(400); // Clamped to ceiling
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_CEIL_CLAMPED).to.be.gt(0);
    });

    it("should work with adapter path", async () => {
      const trancheId = 11;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data (adapter will use this)
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record rolling points
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 250, timestamp);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Should use adapter path with rolling average
      expect(telemetry.adapterRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.rollingAverageBps).to.equal(250);
      expect(telemetry.finalRiskAdjBps).to.equal(250);
      expect(Number(telemetry.telemetryFlags) & FLAG_ADAPTER_USED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.be.gt(0);
    });
  });

  describe("Telemetry Integration", () => {
    it("should set flags correctly when enabled/used", async () => {
      const trancheId = 12;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Test without rolling data (enabled but not used)
      let telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_ENABLED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.equal(0);
      
      // Record data point and test again
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 250, timestamp);
      
      telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_ENABLED).to.be.gt(0);
      expect(Number(telemetry.telemetryFlags) & FLAG_ROLLING_AVG_USED).to.be.gt(0);
    });

    it("should populate rolling fields correctly", async () => {
      const trancheId = 13;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 14);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record data point
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 250, timestamp);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify rolling fields
      expect(telemetry.rollingAverageBps).to.equal(250);
      expect(telemetry.rollingWindowDays).to.equal(14);
    });
  });

  describe("Edge Cases and Gas", () => {
    it("should handle ring buffer wraparound", async () => {
      const trancheId = 14;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Record more than 30 data points to test wraparound
      const timestamp = await time.latest();
      for (let i = 0; i < 35; i++) {
        await config.recordTrancheRiskPoint(trancheId, 200 + i, Number(timestamp) - (35 - i) * 3600);
      }
      
      // Verify buffer head information
      const [count, index] = await config.rollingHead(trancheId);
      expect(count).to.equal(30); // Should be capped at 30
      expect(index).to.equal(5); // Should wrap around
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(telemetry.rollingAverageBps).to.be.gt(0);
    });

    it("should handle large vs small window sizes", async () => {
      const trancheId = 15;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Test small window (1 day)
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 1);
      
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 250, timestamp);
      
      let telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(telemetry.rollingWindowDays).to.equal(1);
      
      // Test large window (90 days)
      await config.setTrancheRollingWindow(trancheId, 90);
      telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(telemetry.rollingWindowDays).to.equal(90);
    });

    it("should handle zero and maximum risk values", async () => {
      const trancheId = 16;
      const baseApyBps = 800;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      // Test zero risk
      await oracle.setTrancheRisk(trancheId, baseApyBps, 0);
      const timestamp = await time.latest();
      await config.recordTrancheRiskPoint(trancheId, 0, timestamp);
      
      let telemetry = await facade.viewTrancheTelemetry(trancheId);
      expect(telemetry.rollingAverageBps).to.equal(0);
      
      // Test maximum risk (5000 bps = 50%) - use different tranche ID
      const maxRiskTrancheId = 19;
      await config.setTrancheRollingEnabled(maxRiskTrancheId, true);
      await config.setTrancheRollingWindow(maxRiskTrancheId, 7);
      await oracle.setTrancheRisk(maxRiskTrancheId, baseApyBps, 5000);
      await config.recordTrancheRiskPoint(maxRiskTrancheId, 4000, timestamp + 1); // Different from oracle, within limit
      
      telemetry = await facade.viewTrancheTelemetry(maxRiskTrancheId);
      expect(telemetry.rollingAverageBps).to.equal(4000);
    });
  });

  describe("Circular Buffer Operations", () => {
    it("should correctly manage buffer index and count", async () => {
      const trancheId = 17;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      const timestamp = await time.latest();
      
      // Add first data point
      await config.recordTrancheRiskPoint(trancheId, 100, timestamp);
      let [count, index] = await config.rollingHead(trancheId);
      expect(count).to.equal(1);
      expect(index).to.equal(1);
      
      // Add second data point
      await config.recordTrancheRiskPoint(trancheId, 200, timestamp);
      [count, index] = await config.rollingHead(trancheId);
      expect(count).to.equal(2);
      expect(index).to.equal(2);
      
      // Add 30th data point
      for (let i = 3; i <= 30; i++) {
        await config.recordTrancheRiskPoint(trancheId, 100 + i, timestamp);
      }
      [count, index] = await config.rollingHead(trancheId);
      expect(count).to.equal(30);
      expect(index).to.equal(0); // Wrapped around
      
      // Add 31st data point (should overwrite first)
      await config.recordTrancheRiskPoint(trancheId, 999, timestamp);
      [count, index] = await config.rollingHead(trancheId);
      expect(count).to.equal(30); // Still capped at 30
      expect(index).to.equal(1); // Next position
    });

    it("should retrieve data points correctly", async () => {
      const trancheId = 18;
      
      // Enable rolling average
      await config.setTrancheRollingEnabled(trancheId, true);
      await config.setTrancheRollingWindow(trancheId, 7);
      
      const timestamp = await time.latest();
      
      // Add data points
      await config.recordTrancheRiskPoint(trancheId, 100, timestamp);
      await config.recordTrancheRiskPoint(trancheId, 200, timestamp);
      
      // Retrieve data points
      const [risk1, ts1] = await config.getRollingDataPoint(trancheId, 0);
      const [risk2, ts2] = await config.getRollingDataPoint(trancheId, 1);
      
      expect(risk1).to.equal(100);
      expect(risk2).to.equal(200);
      expect(ts1).to.equal(timestamp);
      expect(ts2).to.equal(timestamp);
    });
  });
});
