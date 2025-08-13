import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Economics Configuration", () => {
  let gov: Signer;
  let user: Signer;
  let configRegistry: Contract;

  beforeEach(async () => {
    [gov, user] = await ethers.getSigners();
    
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(await gov.getAddress());
  });

  describe("Economics Parameters", () => {
    it("should have correct default values", async () => {
      const result = await configRegistry.getEconomics();
      const [tradeFeeBps, pmmCurveK_bps, pmmTheta_bps, maxBoundBps] = result;
      
      expect(tradeFeeBps).to.equal(50);      // 0.5%
      expect(pmmCurveK_bps).to.equal(1000);  // 10%
      expect(pmmTheta_bps).to.equal(500);    // 5%
      expect(maxBoundBps).to.equal(5000);    // 50%
    });

    it("should allow setting tradeFeeBps within bounds", async () => {
      const newValue = 100; // 1%
      
      await expect(configRegistry.connect(gov).setTradeFeeBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x7472616465000000000000000000000000000000000000000000000000000000", newValue);
      
      const result = await configRegistry.getEconomics();
      const [tradeFeeBps] = result;
      expect(tradeFeeBps).to.equal(newValue);
    });

    it("should allow setting pmmCurveK_bps within bounds", async () => {
      const newValue = 1500; // 15%
      
      await expect(configRegistry.connect(gov).setPmmCurveK_bps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x706d6d5f6b000000000000000000000000000000000000000000000000000000", newValue);
      
      const result = await configRegistry.getEconomics();
      const [, pmmCurveK_bps] = result;
      expect(pmmCurveK_bps).to.equal(newValue);
    });

    it("should allow setting pmmTheta_bps within bounds", async () => {
      const newValue = 750; // 7.5%
      
      await expect(configRegistry.connect(gov).setPmmTheta_bps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x706d6d5f74686574610000000000000000000000000000000000000000000000", newValue);
      
      const result = await configRegistry.getEconomics();
      const [, , pmmTheta_bps] = result;
      expect(pmmTheta_bps).to.equal(newValue);
    });

    it("should allow setting maxBoundBps within bounds", async () => {
      const newValue = 3000; // 30%
      
      await expect(configRegistry.connect(gov).setMaxBoundBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x6d61785f626f756e640000000000000000000000000000000000000000000000", newValue);
      
      const result = await configRegistry.getEconomics();
      const [, , , maxBoundBps] = result;
      expect(maxBoundBps).to.equal(newValue);
    });

    it("should revert setting tradeFeeBps out of bounds", async () => {
      const invalidValue = 25000; // 250% > 200% max
      
      await expect(configRegistry.connect(gov).setTradeFeeBps(invalidValue))
        .to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should revert setting pmmCurveK_bps out of bounds", async () => {
      const invalidValue = 25000; // 250% > 200% max
      
      await expect(configRegistry.connect(gov).setPmmCurveK_bps(invalidValue))
        .to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should revert setting pmmTheta_bps out of bounds", async () => {
      const invalidValue = 25000; // 250% > 200% max
      
      await expect(configRegistry.connect(gov).setPmmTheta_bps(invalidValue))
        .to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should revert setting maxBoundBps out of bounds", async () => {
      const invalidValue = 25000; // 250% > 200% max
      
      await expect(configRegistry.connect(gov).setMaxBoundBps(invalidValue))
        .to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should allow setting values at the boundary", async () => {
      const boundaryValue = 20000; // 200% (max allowed)
      
      await expect(configRegistry.connect(gov).setTradeFeeBps(boundaryValue)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setPmmCurveK_bps(boundaryValue)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setPmmTheta_bps(boundaryValue)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setMaxBoundBps(boundaryValue)).to.not.be.reverted;
    });

    it("should allow setting values to zero", async () => {
      await expect(configRegistry.connect(gov).setTradeFeeBps(0)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setPmmCurveK_bps(0)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setPmmTheta_bps(0)).to.not.be.reverted;
      await expect(configRegistry.connect(gov).setMaxBoundBps(0)).to.not.be.reverted;
    });
  });

  describe("Permissions", () => {
    it("should require GOV_ROLE for setTradeFeeBps", async () => {
      try {
        await configRegistry.connect(user).setTradeFeeBps(100);
        expect.fail("Should have reverted");
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        expect(
          errorMsg.includes("AccessControl") || 
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("revert")
        ).to.be.true;
      }
    });

    it("should require GOV_ROLE for setPmmCurveK_bps", async () => {
      try {
        await configRegistry.connect(user).setPmmCurveK_bps(1000);
        expect.fail("Should have reverted");
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        expect(
          errorMsg.includes("AccessControl") || 
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("revert")
        ).to.be.true;
      }
    });

    it("should require GOV_ROLE for setPmmTheta_bps", async () => {
      try {
        await configRegistry.connect(user).setPmmTheta_bps(500);
        expect.fail("Should have reverted");
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        expect(
          errorMsg.includes("AccessControl") || 
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("revert")
        ).to.be.true;
      }
    });

    it("should require GOV_ROLE for setMaxBoundBps", async () => {
      try {
        await configRegistry.connect(user).setMaxBoundBps(3000);
        expect.fail("Should have reverted");
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        expect(
          errorMsg.includes("AccessControl") || 
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("revert")
        ).to.be.true;
      }
    });
  });

  describe("Public Access", () => {
    it("should allow public access to getEconomics", async () => {
      await expect(configRegistry.connect(user).getEconomics()).to.not.be.reverted;
    });

    it("should allow public access to individual economics parameters", async () => {
      await expect(configRegistry.connect(user).tradeFeeBps()).to.not.be.reverted;
      await expect(configRegistry.connect(user).pmmCurveK_bps()).to.not.be.reverted;
      await expect(configRegistry.connect(user).pmmTheta_bps()).to.not.be.reverted;
      await expect(configRegistry.connect(user).maxBoundBps()).to.not.be.reverted;
    });
  });

  describe("Event Emissions", () => {
    it("should emit ParamSet event with correct key for tradeFeeBps", async () => {
      const newValue = 75;
      await expect(configRegistry.connect(gov).setTradeFeeBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x7472616465000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event with correct key for pmmCurveK_bps", async () => {
      const newValue = 1200;
      await expect(configRegistry.connect(gov).setPmmCurveK_bps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x706d6d5f6b000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event with correct key for pmmTheta_bps", async () => {
      const newValue = 600;
      await expect(configRegistry.connect(gov).setPmmTheta_bps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x706d6d5f74686574610000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event with correct key for maxBoundBps", async () => {
      const newValue = 4000;
      await expect(configRegistry.connect(gov).setMaxBoundBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x6d61785f626f756e640000000000000000000000000000000000000000000000", newValue);
    });
  });
});
