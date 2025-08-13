import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tranche APY Override Tests", () => {
  let config: Contract;
  let oracle: Contract;
  let adapter: Contract;
  let facade: Contract;

  let owner: Signer;
  let ownerAddr: string;

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

  describe("Override Off", () => {
    it("should use adapter/oracle when no override set", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use adapter's risk adjustment (no override)
      expect(apyBps).to.equal(600); // 800 - 200
      expect(asOf).to.be.gt(0);
    });

    it("should match existing golden vectors when no override", async () => {
      const trancheId = 2;
      const baseApyBps = 900;
      const riskAdjBps = 300;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get risk data
      const [base, risk, effective, max, asOf] = await facade.viewTrancheRiskData(trancheId);
      
      expect(base).to.equal(baseApyBps);
      expect(risk).to.equal(riskAdjBps);
      expect(effective).to.equal(600); // 900 - 300
      expect(max).to.equal(5000); // maxBoundBps from config
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Override On", () => {
    it("should use override when set lower than oracle", async () => {
      const trancheId = 3;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 100; // Lower than oracle
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use override (lower risk = higher APY)
      expect(apyBps).to.equal(700); // 800 - 100 (override)
      expect(asOf).to.be.gt(0);
    });

    it("should use override when set higher than oracle", async () => {
      const trancheId = 4;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 400; // Higher than oracle
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use override (higher risk = lower APY)
      expect(apyBps).to.equal(400); // 800 - 400 (override)
      expect(asOf).to.be.gt(0);
    });

    it("should clamp override to max APY bounds", async () => {
      const trancheId = 5;
      const baseApyBps = 6000; // High base APY
      const overrideRiskAdjBps = 500; // Low risk adjustment
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, 1000);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should be clamped to maxBoundBps (5000)
      expect(apyBps).to.equal(5000); // Clamped to max
      expect(asOf).to.be.gt(0);
    });

    it("should handle override that would result in zero APY", async () => {
      const trancheId = 6;
      const baseApyBps = 500;
      const overrideRiskAdjBps = 600; // Higher than base
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, 100);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should be clamped to zero
      expect(apyBps).to.equal(0); // max(0, 500 - 600) = 0
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Bounds Validation", () => {
    it("should revert when setting override above maxBoundBps", async () => {
      const trancheId = 7;
      const maxBoundBps = await config.maxBoundBps();
      const invalidOverride = Number(maxBoundBps) + 100;
      
      await expect(
        config.setTrancheRiskAdjOverrideBps(trancheId, invalidOverride)
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should allow setting override equal to maxBoundBps", async () => {
      const trancheId = 8;
      const maxBoundBps = await config.maxBoundBps();
      
      await expect(
        config.setTrancheRiskAdjOverrideBps(trancheId, Number(maxBoundBps))
      ).to.not.be.reverted;
    });

    it("should allow setting override to zero", async () => {
      const trancheId = 9;
      
      await expect(
        config.setTrancheRiskAdjOverrideBps(trancheId, 0)
      ).to.not.be.reverted;
    });
  });

  describe("Permissions", () => {
    it("should only allow GOV_ROLE to set override", async () => {
      const trancheId = 10;
      const [, nonGov] = await ethers.getSigners();
      
      await expect(
        config.connect(nonGov).setTrancheRiskAdjOverrideBps(trancheId, 100)
      ).to.be.reverted;
    });

    it("should allow GOV_ROLE to set override", async () => {
      const trancheId = 11;
      
      await expect(
        config.setTrancheRiskAdjOverrideBps(trancheId, 100)
      ).to.not.be.reverted;
    });
  });

  describe("Staleness Interaction", () => {
    it("should revert with stale data when override is zero", async () => {
      const trancheId = 12;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data with old timestamp
      const oldTimestamp = (await time.latest()) - 7200; // 2 hours ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, oldTimestamp);
      
      // No override set (defaults to 0)
      
      // Should revert with StaleRiskData error
      await expect(
        facade.viewEffectiveApy(trancheId)
      ).to.be.revertedWithCustomError(adapter, "StaleRiskData");
    });

    it("should succeed with stale data when override is set", async () => {
      const trancheId = 13;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      const overrideRiskAdjBps = 150;
      
      // Set oracle data with old timestamp
      const oldTimestamp = (await time.latest()) - 7200; // 2 hours ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, oldTimestamp);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Should succeed and use override
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(650); // 800 - 150 (override)
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Override Precedence", () => {
    it("should use override even when adapter is disabled", async () => {
      const trancheId = 14;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 100;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Deploy facade with adapter disabled
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      const disabledFacade = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        await adapter.getAddress(),
        false // enableTrancheRisk
      );
      
      // Should use override
      const [apyBps, asOf] = await disabledFacade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(700); // 800 - 100 (override)
      expect(asOf).to.be.gt(0);
    });

    it("should use override even with zero-address adapter", async () => {
      const trancheId = 15;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 100;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Deploy facade with zero-address adapter
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      const zeroAdapterFacade = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        ethers.ZeroAddress, // zero-address adapter
        true // enableTrancheRisk
      );
      
      // Should use override
      const [apyBps, asOf] = await zeroAdapterFacade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(700); // 800 - 100 (override)
      expect(asOf).to.be.gt(0);
    });
  });
});
