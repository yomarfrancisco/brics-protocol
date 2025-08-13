import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tranche Telemetry Tests", () => {
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

  describe("Oracle Direct Path", () => {
    let facadeOracleDirect: Contract;

    beforeEach(async () => {
      // Deploy TrancheReadFacade with adapter disabled
      const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
      facadeOracleDirect = await TrancheReadFacade.deploy(
        await oracle.getAddress(),
        await config.getAddress(),
        ethers.ZeroAddress, // No adapter
        false // enableTrancheRisk disabled
      );
    });

    it("should return correct telemetry for oracle direct path", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Get telemetry data
      const telemetry = await facadeOracleDirect.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(0);
      expect(telemetry.finalRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.effectiveApyBps).to.equal(600); // 800 - 200
      expect(telemetry.maxApyBps).to.equal(5000); // maxBoundBps from config
      expect(telemetry.floorBps).to.equal(0);
      expect(telemetry.ceilBps).to.equal(0);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ORACLE_DIRECT);
    });
  });

  describe("Adapter Path", () => {
    it("should return correct telemetry for adapter path", async () => {
      const trancheId = 2;
      const baseApyBps = 900;
      const oracleRiskAdjBps = 300;
      
      // Set oracle data (adapter will use this)
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(oracleRiskAdjBps); // Adapter returns same as oracle
      expect(telemetry.finalRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.effectiveApyBps).to.equal(600); // 900 - 300
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(0);
      expect(telemetry.ceilBps).to.equal(0);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ADAPTER_USED);
    });
  });

  describe("Override Path", () => {
    it("should return correct telemetry for override path", async () => {
      const trancheId = 3;
      const baseApyBps = 1000;
      const oracleRiskAdjBps = 400;
      const overrideRiskAdjBps = 150;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(overrideRiskAdjBps);
      expect(telemetry.adapterRiskAdjBps).to.equal(0);
      expect(telemetry.finalRiskAdjBps).to.equal(overrideRiskAdjBps);
      expect(telemetry.effectiveApyBps).to.equal(850); // 1000 - 150
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(0);
      expect(telemetry.ceilBps).to.equal(0);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_OVERRIDE_USED);
    });
  });

  describe("Bands Enabled", () => {
    it("should return correct telemetry for bands enabled without clamping", async () => {
      const trancheId = 4;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const floorBps = 100;
      const ceilBps = 300;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(oracleRiskAdjBps); // Adapter returns same as oracle
      expect(telemetry.finalRiskAdjBps).to.equal(oracleRiskAdjBps); // No clamping needed
      expect(telemetry.effectiveApyBps).to.equal(600); // 800 - 200
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(floorBps);
      expect(telemetry.ceilBps).to.equal(ceilBps);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED);
    });

    it("should return correct telemetry for floor clamping", async () => {
      const trancheId = 5;
      const baseApyBps = 900;
      const oracleRiskAdjBps = 50; // Below floor
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(oracleRiskAdjBps); // Adapter returns same as oracle
      expect(telemetry.finalRiskAdjBps).to.equal(floorBps); // Clamped to floor
      expect(telemetry.effectiveApyBps).to.equal(700); // 900 - 200
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(floorBps);
      expect(telemetry.ceilBps).to.equal(ceilBps);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED | FLAG_FLOOR_CLAMPED);
    });

    it("should return correct telemetry for ceiling clamping", async () => {
      const trancheId = 6;
      const baseApyBps = 1000;
      const oracleRiskAdjBps = 500; // Above ceiling
      const floorBps = 100;
      const ceilBps = 300;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(oracleRiskAdjBps); // Adapter returns same as oracle
      expect(telemetry.finalRiskAdjBps).to.equal(ceilBps); // Clamped to ceiling
      expect(telemetry.effectiveApyBps).to.equal(700); // 1000 - 300
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(floorBps);
      expect(telemetry.ceilBps).to.equal(ceilBps);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED | FLAG_CEIL_CLAMPED);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle override with bands enabled", async () => {
      const trancheId = 7;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      const overrideRiskAdjBps = 50; // Below floor
      const floorBps = 100;
      const ceilBps = 300;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Set override
      await config.setTrancheRiskAdjOverrideBps(trancheId, overrideRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(oracleRiskAdjBps);
      expect(telemetry.overrideRiskAdjBps).to.equal(overrideRiskAdjBps);
      expect(telemetry.adapterRiskAdjBps).to.equal(0);
      expect(telemetry.finalRiskAdjBps).to.equal(floorBps); // Override clamped to floor
      expect(telemetry.effectiveApyBps).to.equal(700); // 800 - 100
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(floorBps);
      expect(telemetry.ceilBps).to.equal(ceilBps);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_OVERRIDE_USED | FLAG_BANDS_ENABLED | FLAG_FLOOR_CLAMPED);
    });

    it("should handle adapter with bands enabled", async () => {
      const trancheId = 8;
      const baseApyBps = 900;
      const oracleRiskAdjBps = 300;
      const adapterRiskAdjBps = 450; // Above ceiling
      const floorBps = 200;
      const ceilBps = 400;
      
      // Set oracle data (adapter will use this)
      await oracle.setTrancheRisk(trancheId, baseApyBps, adapterRiskAdjBps);
      
      // Set bands
      await config.setTrancheRiskBands(trancheId, floorBps, ceilBps);
      
      // Get telemetry data
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify all fields
      expect(telemetry.baseApyBps).to.equal(baseApyBps);
      expect(telemetry.oracleRiskAdjBps).to.equal(adapterRiskAdjBps); // Oracle and adapter have same value
      expect(telemetry.overrideRiskAdjBps).to.equal(0);
      expect(telemetry.adapterRiskAdjBps).to.equal(adapterRiskAdjBps);
      expect(telemetry.finalRiskAdjBps).to.equal(ceilBps); // Adapter clamped to ceiling
      expect(telemetry.effectiveApyBps).to.equal(500); // 900 - 400
      expect(telemetry.maxApyBps).to.equal(5000);
      expect(telemetry.floorBps).to.equal(floorBps);
      expect(telemetry.ceilBps).to.equal(ceilBps);
      expect(telemetry.asOf).to.be.gt(0);
      expect(telemetry.telemetryFlags).to.equal(FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED | FLAG_CEIL_CLAMPED);
    });
  });

  describe("Telemetry Flag Combinations", () => {
    it("should correctly set all flag combinations", async () => {
      const testCases = [
        {
          name: "oracle direct only",
          oracleRisk: 200,
          override: 0,
          adapterRisk: 0,
          floor: 0,
          ceil: 0,
          expectedFlags: FLAG_ADAPTER_USED // Adapter is enabled in main setup
        },
        {
          name: "adapter only",
          oracleRisk: 300,
          override: 0,
          adapterRisk: 250,
          floor: 0,
          ceil: 0,
          expectedFlags: FLAG_ADAPTER_USED
        },
        {
          name: "override only",
          oracleRisk: 400,
          override: 150,
          adapterRisk: 0,
          floor: 0,
          ceil: 0,
          expectedFlags: FLAG_OVERRIDE_USED
        },
        {
          name: "oracle with bands",
          oracleRisk: 200,
          override: 0,
          adapterRisk: 0,
          floor: 100,
          ceil: 300,
          expectedFlags: FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED // Adapter is enabled in main setup
        },
        {
          name: "oracle with floor clamp",
          oracleRisk: 50,
          override: 0,
          adapterRisk: 0,
          floor: 100,
          ceil: 300,
          expectedFlags: FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED | FLAG_FLOOR_CLAMPED // Adapter is enabled in main setup
        },
        {
          name: "oracle with ceiling clamp",
          oracleRisk: 400,
          override: 0,
          adapterRisk: 0,
          floor: 100,
          ceil: 300,
          expectedFlags: FLAG_ADAPTER_USED | FLAG_BANDS_ENABLED | FLAG_CEIL_CLAMPED // Adapter is enabled in main setup
        }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const trancheId = 100 + i;
        
        // Set oracle data
        await oracle.setTrancheRisk(trancheId, 800, testCase.oracleRisk);
        
        // Set override if specified
        if (testCase.override > 0) {
          await config.setTrancheRiskAdjOverrideBps(trancheId, testCase.override);
        }
        
        // Note: adapter.setRisk doesn't exist - adapter just calls oracle
        // So we don't need to set adapter data separately
        
        // Set bands if specified
        if (testCase.ceil > 0) {
          await config.setTrancheRiskBands(trancheId, testCase.floor, testCase.ceil);
        }
        
        // Get telemetry data
        const telemetry = await facade.viewTrancheTelemetry(trancheId);
        
        // Verify flags
        expect(telemetry.telemetryFlags, testCase.name).to.equal(testCase.expectedFlags);
      }
    });
  });

  describe("Parity with Existing Functions", () => {
    it("should match viewEffectiveApy results", async () => {
      const trancheId = 200;
      const baseApyBps = 800;
      const oracleRiskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Get results from both functions
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify parity
      expect(telemetry.effectiveApyBps).to.equal(apyBps);
      expect(telemetry.asOf).to.equal(asOf);
    });

    it("should match viewTrancheRiskData results", async () => {
      const trancheId = 201;
      const baseApyBps = 900;
      const oracleRiskAdjBps = 300;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, oracleRiskAdjBps);
      
      // Get results from both functions
      const [base, risk, effective, max, asOf] = await facade.viewTrancheRiskData(trancheId);
      const telemetry = await facade.viewTrancheTelemetry(trancheId);
      
      // Verify parity
      expect(telemetry.baseApyBps).to.equal(base);
      expect(telemetry.finalRiskAdjBps).to.equal(risk);
      expect(telemetry.effectiveApyBps).to.equal(effective);
      expect(telemetry.maxApyBps).to.equal(max);
      expect(telemetry.asOf).to.equal(asOf);
    });
  });
});
