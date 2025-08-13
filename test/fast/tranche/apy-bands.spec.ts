import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tranche APY Bands Tests", () => {
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

  describe("No Bands Set", () => {
    it("should match existing parity when no bands set", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should match existing behavior (no bands)
      expect(apyBps).to.equal(600); // 800 - 200
      expect(asOf).to.be.gt(0);
    });

    it("should match golden vectors when no bands set", async () => {
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

  describe("Bands Narrower Than Oracle", () => {
    it("should clamp riskAdj to floor when oracle below floor", async () => {
      const trancheId = 3;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 100; // Below floor
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should clamp to floor (higher risk = lower APY)
      expect(apyBps).to.equal(600); // 800 - 200 (floor)
      expect(asOf).to.be.gt(0);
    });

    it("should clamp riskAdj to ceiling when oracle above ceiling", async () => {
      const trancheId = 4;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 500; // Above ceiling
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should clamp to ceiling (lower risk = higher APY)
      expect(apyBps).to.equal(400); // 800 - 400 (ceiling)
      expect(asOf).to.be.gt(0);
    });

    it("should not clamp when oracle within bands", async () => {
      const trancheId = 5;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 300; // Within bands
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use oracle value (no clamping)
      expect(apyBps).to.equal(500); // 800 - 300 (oracle)
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Bands With Override Present", () => {
    it("should clamp override value to bands", async () => {
      const trancheId = 6;
      const baseApyBps = 800;
      const overrideRiskAdjBps = 500; // Above ceiling
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, 100);
      
      // Set override and bands
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use override then clamp to ceiling
      expect(apyBps).to.equal(400); // 800 - 400 (ceiling)
      expect(asOf).to.be.gt(0);
    });

    it("should clamp override to floor when below floor", async () => {
      const trancheId = 7;
      const baseApyBps = 800;
      const overrideRiskAdjBps = 100; // Below floor
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, 300);
      
      // Set override and bands
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use override then clamp to floor
      expect(apyBps).to.equal(600); // 800 - 200 (floor)
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Invalid Bands", () => {
    it("should revert when floor > ceiling", async () => {
      const trancheId = 8;
      const floorBps = 400;
      const ceilBps = 200; // Floor > ceiling
      
      await expect(
        config.setTrancheRiskBands(trancheId, floorBps, ceilBps)
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should revert when ceiling > maxBoundBps", async () => {
      const trancheId = 9;
      const maxBoundBps = await config.maxBoundBps();
      const floorBps = 200;
      const ceilBps = Number(maxBoundBps) + 100; // Above max
      
      await expect(
        config.setTrancheRiskBands(trancheId, floorBps, ceilBps)
      ).to.be.revertedWithCustomError(config, "BadParam");
    });

    it("should allow setting bands equal to maxBoundBps", async () => {
      const trancheId = 10;
      const maxBoundBps = await config.maxBoundBps();
      const floorBps = 200;
      const ceilBps = Number(maxBoundBps);
      
      await expect(
        config.setTrancheRiskBands(trancheId, floorBps, ceilBps)
      ).to.not.be.reverted;
    });

    it("should allow setting floor equal to ceiling", async () => {
      const trancheId = 11;
      const floorBps = 300;
      const ceilBps = 300; // Equal
      
      await expect(
        config.setTrancheRiskBands(trancheId, floorBps, ceilBps)
      ).to.not.be.reverted;
    });
  });

  describe("Governance Permissions", () => {
    it("should only allow GOV_ROLE to set bands", async () => {
      const trancheId = 12;
      const [, nonGov] = await ethers.getSigners();
      
      await expect(
        config.connect(nonGov).setTrancheRiskBands(trancheId, 200, 400)
      ).to.be.reverted;
    });

    it("should allow GOV_ROLE to set bands", async () => {
      const trancheId = 13;
      
      await expect(
        config.setTrancheRiskBands(trancheId, 200, 400)
      ).to.not.be.reverted;
    });
  });

  describe("Staleness + Bands", () => {
    it("should still revert with stale data when override=0", async () => {
      const trancheId = 14;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      const floorBps = 100;
      const ceilBps = 300;
      
      // Set oracle data with old timestamp
      const oldTimestamp = (await time.latest()) - 7200; // 2 hours ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, oldTimestamp);
      
      // Set bands but no override
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Should still revert with StaleRiskData error
      await expect(
        facade.viewEffectiveApy(trancheId)
      ).to.be.revertedWithCustomError(adapter, "StaleRiskData");
    });

    it("should use override then clamp when override>0 and stale", async () => {
      const trancheId = 15;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      const overrideRiskAdjBps = 500; // Above ceiling
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data with old timestamp
      const oldTimestamp = (await time.latest()) - 7200; // 2 hours ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, oldTimestamp);
      
      // Set override and bands
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Should succeed and use override then clamp
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(400); // 800 - 400 (ceiling)
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Band Disabling", () => {
    it("should disable bands when ceiling=0", async () => {
      const trancheId = 16;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 100; // Would be clamped if bands enabled
      const floorBps = 0;
      const ceilBps = 0; // Disabled
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands with ceiling=0
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Should use oracle value (no clamping)
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(700); // 800 - 100 (oracle)
      expect(asOf).to.be.gt(0);
    });

    it("should allow re-enabling bands", async () => {
      const trancheId = 17;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 100;
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Disable bands
      await config.setTrancheRiskBands(trancheId, 0, 0);
      let [apyBps] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(700); // 800 - 100 (oracle)
      
      // Re-enable bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      [apyBps] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(600); // 800 - 200 (floor)
    });
  });
});
