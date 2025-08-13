import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tranche APY Integration Tests", () => {
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

  describe("Happy Path", () => {
    it("should use adapter for risk adjustment when enabled", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should use adapter's risk adjustment (which gets from oracle)
      expect(apyBps).to.equal(600); // 800 - 200
      expect(asOf).to.be.gt(0);
    });

    it("should return complete risk data with adapter", async () => {
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

  describe("Staleness Guards", () => {
    it("should revert when adapter data is stale", async () => {
      const trancheId = 3;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data with old timestamp
      const oldTimestamp = (await time.latest()) - 7200; // 2 hours ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, oldTimestamp);
      
      // Should revert with StaleRiskData error
      await expect(
        facade.viewEffectiveApy(trancheId)
      ).to.be.revertedWithCustomError(adapter, "StaleRiskData");
    });

    it("should work with fresh data", async () => {
      const trancheId = 4;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data with recent timestamp
      const recentTimestamp = (await time.latest()) - 1800; // 30 minutes ago
      await oracle.setTrancheRiskWithTimestamp(trancheId, baseApyBps, riskAdjBps, recentTimestamp);
      
      // Should work fine
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(600);
    });
  });

  describe("Adapter Toggles", () => {
    it("should use adapter when enabled", async () => {
      const trancheId = 5;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Deploy facade with adapter enabled
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      const enabledFacade = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        await adapter.getAddress(),
        true // enableTrancheRisk
      );
      
      const [apyBps, asOf] = await enabledFacade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(600); // Uses adapter
    });

    it("should ignore adapter when disabled", async () => {
      const trancheId = 6;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Deploy facade with adapter disabled
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      const disabledFacade = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        await adapter.getAddress(),
        false // enableTrancheRisk
      );
      
      const [apyBps, asOf] = await disabledFacade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(600); // Still works, uses oracle directly
    });

    it("should work with zero-address adapter", async () => {
      const trancheId = 7;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Deploy facade with zero-address adapter
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      const zeroAdapterFacade = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        ethers.ZeroAddress, // zero-address adapter
        true // enableTrancheRisk
      );
      
      const [apyBps, asOf] = await zeroAdapterFacade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(600); // Falls back to oracle
    });
  });

  describe("Adapter Configuration", () => {
    it("should allow governance to update oracle", async () => {
      const newOracle = await ethers.getContractFactory("MockTrancheRiskOracle");
      const newOracleInstance = await newOracle.deploy();
      
      await adapter.setOracle(await newOracleInstance.getAddress());
      expect(await adapter.oracle()).to.equal(await newOracleInstance.getAddress());
    });

    it("should allow governance to update max age", async () => {
      const newMaxAge = 7200; // 2 hours
      await adapter.setMaxAge(newMaxAge);
      expect(await adapter.maxAge()).to.equal(newMaxAge);
    });

    it("should revert when non-governance tries to update oracle", async () => {
      const [, nonGov] = await ethers.getSigners();
      await expect(
        adapter.connect(nonGov).setOracle(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should revert when non-governance tries to update max age", async () => {
      const [, nonGov] = await ethers.getSigners();
      await expect(
        adapter.connect(nonGov).setMaxAge(7200)
      ).to.be.reverted;
    });
  });
});
