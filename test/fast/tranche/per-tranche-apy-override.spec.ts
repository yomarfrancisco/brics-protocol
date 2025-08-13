import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Contract, Signer } from "ethers";

describe("Per-Tranche Base APY Override", function () {
  let config: Contract;
  let facade: Contract;
  let oracle: Contract;
  let adapter: Contract;
  let deployer: Signer;
  let gov: Signer;
  let user: Signer;

  const trancheId = 1;
  const FLAG_BASE_APY_OVERRIDE_USED = 0x01;
  const FLAG_RISK_OVERRIDE_USED = 0x02;
  const FLAG_ADAPTER_USED = 0x04;
  const FLAG_ORACLE_DIRECT = 0x08;
  const FLAG_ROLLING_AVG_ENABLED = 0x10;
  const FLAG_ROLLING_AVG_USED = 0x20;
  const FLAG_BANDS_ENABLED = 0x40;
  const FLAG_FLOOR_CLAMPED = 0x80;
  const FLAG_CEIL_CLAMPED = 0x100;

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

    // Set up mock data
    await oracle.setTrancheRisk(trancheId, 500, 200);
  });

  describe("Basic Functionality", function () {
    it("should return 0 when no override is set", async function () {
      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(0);
    });

    it("should set and retrieve base APY override", async function () {
      const newOverride = 1000; // 10%
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, newOverride);
      
      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(newOverride);
    });

    it("should apply base APY override in viewEffectiveApy", async function () {
      const override = 1500; // 15%
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override);

      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use override instead of oracle base APY (500)
      expect(apyBps).to.be.above(500);
    });

    it("should apply base APY override in viewTrancheRiskData", async function () {
      const override = 1200; // 12%
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override);

      const [baseApyBps, riskAdjBps, effectiveApyBps, maxApyBps, asOf] = 
        await facade.viewTrancheRiskData(trancheId);
      
      expect(baseApyBps).to.equal(override);
    });
  });

  describe("Governance Controls", function () {
    it("should only allow GOV_ROLE to set override", async function () {
      const newOverride = 1000;
      
      await expect(
        config.connect(user).setTrancheBaseApyOverrideBps(trancheId, newOverride)
      ).to.be.revertedWithCustomError(config, "AccessControlUnauthorizedAccount");
    });

    it("should validate parameter bounds", async function () {
      // Max allowed is 50000 (500%)
      await expect(
        config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, 50001)
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should allow setting to 0 to disable override", async function () {
      // First set an override
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, 1000);
      
      // Then disable it
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, 0);
      
      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(0);
    });

    it("should emit proper events", async function () {
      const newOverride = 1000;
      
      await expect(config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, newOverride))
        .to.emit(config, "TrancheBaseApyOverrideSet")
        .withArgs(trancheId, 0, newOverride);
    });
  });

  describe("Integration Precedence", function () {
    it("should work with risk adjustment overrides", async function () {
      const baseApyOverride = 1500; // 15%
      const riskOverride = 400; // 4%
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, baseApyOverride);
      await config.connect(gov).setTrancheRiskAdjOverrideBps(trancheId, riskOverride);

      const [baseApyBps, riskAdjBps, effectiveApyBps, maxApyBps, asOf] = 
        await facade.viewTrancheRiskData(trancheId);
      
      expect(baseApyBps).to.equal(baseApyOverride);
      expect(riskAdjBps).to.equal(riskOverride);
    });

    it("should work with rolling average", async function () {
      const baseApyOverride = 1200; // 12%
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, baseApyOverride);
      await config.connect(gov).setTrancheRollingEnabled(trancheId, true);
      await config.connect(gov).setTrancheRollingWindow(trancheId, 7);
      await config.connect(gov).recordTrancheRiskPoint(trancheId, 250, await time.latest());

      const [baseApyBps, riskAdjBps, effectiveApyBps, maxApyBps, asOf] = 
        await facade.viewTrancheRiskData(trancheId);
      
      expect(baseApyBps).to.equal(baseApyOverride);
    });

    it("should work with confidence bands", async function () {
      const baseApyOverride = 1800; // 18%
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, baseApyOverride);
      await config.connect(gov).setTrancheRiskBands(trancheId, 200, 400);

      const [baseApyBps, riskAdjBps, effectiveApyBps, maxApyBps, asOf] = 
        await facade.viewTrancheRiskData(trancheId);
      
      expect(baseApyBps).to.equal(baseApyOverride);
      // Risk should be clamped by bands
      expect(riskAdjBps).to.be.at.least(200);
      expect(riskAdjBps).to.be.at.most(400);
    });
  });

  describe("Telemetry Integration", function () {
    it("should set base APY override flag correctly", async function () {
      const override = 1000;
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override);

      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      expect(Number(telemetry.telemetryFlags) & FLAG_BASE_APY_OVERRIDE_USED).to.be.above(0);
      expect(telemetry.baseApyOverrideBps).to.equal(override);
      expect(telemetry.baseApyBps).to.equal(override);
    });

    it("should not set flag when no override is set", async function () {
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      expect(Number(telemetry.telemetryFlags) & FLAG_BASE_APY_OVERRIDE_USED).to.equal(0);
      expect(telemetry.baseApyOverrideBps).to.equal(0);
      expect(telemetry.baseApyBps).to.equal(500); // Oracle value
    });

    it("should populate all telemetry fields correctly", async function () {
      const override = 1500;
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override);

      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      expect(telemetry.oracleBaseApyBps).to.equal(500); // Original oracle value
      expect(telemetry.baseApyOverrideBps).to.equal(override);
      expect(telemetry.baseApyBps).to.equal(override); // Final value after override
    });

    it("should work with multiple flags simultaneously", async function () {
      const baseApyOverride = 1200;
      const riskOverride = 350;
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, baseApyOverride);
      await config.connect(gov).setTrancheRiskAdjOverrideBps(trancheId, riskOverride);

      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      const flags = Number(telemetry.telemetryFlags);
      
      expect(flags & FLAG_BASE_APY_OVERRIDE_USED).to.be.above(0);
      expect(flags & FLAG_RISK_OVERRIDE_USED).to.be.above(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle maximum allowed value", async function () {
      const maxOverride = 50000; // 500%
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, maxOverride);

      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(maxOverride);
    });

    it("should handle zero value", async function () {
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, 0);

      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(0);
    });

    it("should work with different tranche IDs", async function () {
      const trancheId2 = 2;
      const override1 = 1000;
      const override2 = 2000;
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override1);
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId2, override2);

      expect(await config.trancheBaseApyOverrideBps(trancheId)).to.equal(override1);
      expect(await config.trancheBaseApyOverrideBps(trancheId2)).to.equal(override2);
    });

    it("should handle multiple updates to same tranche", async function () {
      const override1 = 1000;
      const override2 = 2000;
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override1);
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, override2);

      const override = await config.trancheBaseApyOverrideBps(trancheId);
      expect(override).to.equal(override2);
    });
  });

  describe("Precedence Order", function () {
    it("should follow correct precedence: Base APY Override → Risk Override → Rolling → Bands → APY clamp", async function () {
      // Set up all features
      const baseApyOverride = 1500;
      const riskOverride = 400;
      
      await config.connect(gov).setTrancheBaseApyOverrideBps(trancheId, baseApyOverride);
      await config.connect(gov).setTrancheRiskAdjOverrideBps(trancheId, riskOverride);
      await config.connect(gov).setTrancheRollingEnabled(trancheId, true);
      await config.connect(gov).setTrancheRollingWindow(trancheId, 7);
      await config.connect(gov).setTrancheRiskBands(trancheId, 200, 500);

      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Base APY should be overridden
      expect(telemetry.baseApyBps).to.equal(baseApyOverride);
      expect(Number(telemetry.telemetryFlags) & FLAG_BASE_APY_OVERRIDE_USED).to.be.above(0);
      
      // Risk should be overridden (not affected by rolling average or bands)
      expect(telemetry.finalRiskAdjBps).to.equal(riskOverride);
      expect(Number(telemetry.telemetryFlags) & FLAG_RISK_OVERRIDE_USED).to.be.above(0);
    });
  });
});
