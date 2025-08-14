import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Tranche APY View Tests", () => {
  let config: Contract;
  let oracle: Contract;
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

    // Deploy TrancheReadFacade with all required constructor arguments
    const TrancheReadFacade = await ethers.getContractFactory("TrancheReadFacade");
    facade = await TrancheReadFacade.deploy(
      await oracle.getAddress(),
      await config.getAddress(),
      ethers.ZeroAddress, // riskAdapter (null address)
      false // enableTrancheRisk
    );
  });

  describe("Effective APY Calculation", () => {
    it("should calculate effective APY correctly", async () => {
      const trancheId = 1;
      const baseApyBps = 800;
      const riskAdjBps = 200;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should be base - risk = 800 - 200 = 600 bps
      expect(apyBps).to.equal(600);
      expect(asOf).to.be.gt(0);
    });

    it("should clamp to max APY when exceeded", async () => {
      const trancheId = 2;
      const baseApyBps = 1200;
      const riskAdjBps = 100;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should be clamped to maxBoundBps (5000 bps)
      expect(apyBps).to.equal(1100); // 1200 - 100 = 1100, not clamped
      expect(asOf).to.be.gt(0);
    });

    it("should return zero when risk >= base", async () => {
      const trancheId = 3;
      const baseApyBps = 500;
      const riskAdjBps = 600;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get effective APY
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      
      // Should be zero since risk > base
      expect(apyBps).to.equal(0);
      expect(asOf).to.be.gt(0);
    });
  });

  describe("Tranche Risk Data", () => {
    it("should return complete risk data", async () => {
      const trancheId = 4;
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

  describe("Edge Cases", () => {
    it("should handle zero base APY", async () => {
      const trancheId = 5;
      await oracle.setTrancheRisk(trancheId, 0, 100);
      
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(0);
    });

    it("should handle zero risk adjustment", async () => {
      const trancheId = 6;
      await oracle.setTrancheRisk(trancheId, 800, 0);
      
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(800);
    });

    it("should handle equal base and risk", async () => {
      const trancheId = 7;
      await oracle.setTrancheRisk(trancheId, 500, 500);
      
      const [apyBps, asOf] = await facade.viewEffectiveApy(trancheId);
      expect(apyBps).to.equal(0);
    });
  });

  describe("Config Integration", () => {
    it("should use config maxBoundBps for max APY", async () => {
      const trancheId = 8;
      const baseApyBps = 6000;
      const riskAdjBps = 500;
      
      // Set oracle data
      await oracle.setTrancheRisk(trancheId, baseApyBps, riskAdjBps);
      
      // Get risk data
      const [base, risk, effective, max, asOf] = await facade.viewTrancheRiskData(trancheId);
      
      // Should be clamped to maxBoundBps (5000)
      expect(effective).to.equal(5000);
      expect(max).to.equal(5000);
    });
  });
});
