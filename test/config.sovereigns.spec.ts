import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("ConfigRegistry - SPEC §6 Cross-Sovereign Configuration", function () {
  let configRegistry: Contract;
  let owner: Signer;
  let gov: Signer;
  let user: Signer;
  let ownerAddress: string;
  let govAddress: string;

  const SOVEREIGN_CODE_1 = ethers.utils.formatBytes32String("SOV_1");
  const SOVEREIGN_CODE_2 = ethers.utils.formatBytes32String("SOV_2");
  const SOVEREIGN_CODE_3 = ethers.utils.formatBytes32String("SOV_3");

  beforeEach(async function () {
    [owner, gov, user] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    govAddress = await gov.getAddress();

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(govAddress);
  });

  describe("SPEC §6: Cross-Sovereign Configuration CRUD", function () {
    it("should add sovereign with valid parameters", async function () {
      await expect(
        configRegistry.addSovereign(
          SOVEREIGN_CODE_1,
          8000, // 80% utilization cap
          2000, // 20% haircut
          5000, // 50% weight
          true  // enabled
        )
      ).to.emit(configRegistry, "SovereignAdded")
        .withArgs(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);

      const sovereign = await configRegistry.getSovereign(SOVEREIGN_CODE_1);
      expect(sovereign.exists).to.be.true;
      expect(sovereign.utilCapBps).to.equal(8000);
      expect(sovereign.haircutBps).to.equal(2000);
      expect(sovereign.weightBps).to.equal(5000);
      expect(sovereign.enabled).to.be.true;
    });

    it("should validate bps ≤ 10000", async function () {
      await expect(
        configRegistry.addSovereign(
          SOVEREIGN_CODE_1,
          11000, // > 10000
          2000,
          5000,
          true
        )
      ).to.be.revertedWithCustomError(configRegistry, "BadParam");

      await expect(
        configRegistry.addSovereign(
          SOVEREIGN_CODE_1,
          8000,
          11000, // > 10000
          5000,
          true
        )
      ).to.be.revertedWithCustomError(configRegistry, "BadParam");

      await expect(
        configRegistry.addSovereign(
          SOVEREIGN_CODE_1,
          8000,
          2000,
          11000, // > 10000
          true
        )
      ).to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should revert on unknown sovereign", async function () {
      await expect(
        configRegistry.getSovereign(SOVEREIGN_CODE_1)
      ).to.be.revertedWithCustomError(configRegistry, "UnknownSovereign")
        .withArgs(SOVEREIGN_CODE_1);
    });

    it("should maintain insertion order", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);
      await configRegistry.addSovereign(SOVEREIGN_CODE_2, 7000, 3000, 4000, false);
      await configRegistry.addSovereign(SOVEREIGN_CODE_3, 9000, 1000, 6000, true);

      const sovereigns = await configRegistry.sovereigns();
      expect(sovereigns.length).to.equal(3);
      expect(sovereigns[0]).to.equal(SOVEREIGN_CODE_1);
      expect(sovereigns[1]).to.equal(SOVEREIGN_CODE_2);
      expect(sovereigns[2]).to.equal(SOVEREIGN_CODE_3);
    });

    it("should update sovereign configuration", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);

      await expect(
        configRegistry.updateSovereign(
          SOVEREIGN_CODE_1,
          7500, // updated utilization cap
          2500, // updated haircut
          4500, // updated weight
          false  // updated enabled flag
        )
      ).to.emit(configRegistry, "SovereignUpdated")
        .withArgs(SOVEREIGN_CODE_1, 7500, 2500, 4500, false);

      const sovereign = await configRegistry.getSovereign(SOVEREIGN_CODE_1);
      expect(sovereign.utilCapBps).to.equal(7500);
      expect(sovereign.haircutBps).to.equal(2500);
      expect(sovereign.weightBps).to.equal(4500);
      expect(sovereign.enabled).to.be.false;
    });

    it("should set sovereign enabled flag", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, false);

      await expect(
        configRegistry.setSovereignEnabled(SOVEREIGN_CODE_1, true)
      ).to.emit(configRegistry, "SovereignEnabled")
        .withArgs(SOVEREIGN_CODE_1, true);

      const sovereign = await configRegistry.getSovereign(SOVEREIGN_CODE_1);
      expect(sovereign.enabled).to.be.true;
    });

    it("should calculate effective capacity correctly", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);

      const [effectiveCap, isEnabled] = await configRegistry.getEffectiveCapacity(SOVEREIGN_CODE_1);
      
      // Effective capacity = 8000 * (1 - 2000/10000) = 8000 * 0.8 = 6400
      expect(effectiveCap).to.equal(6400);
      expect(isEnabled).to.be.true;
    });

    it("should return zero capacity for disabled sovereign", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, false);

      const [effectiveCap, isEnabled] = await configRegistry.getEffectiveCapacity(SOVEREIGN_CODE_1);
      
      expect(effectiveCap).to.equal(0);
      expect(isEnabled).to.be.false;
    });

    it("should calculate total effective capacity", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);  // 6400 effective
      await configRegistry.addSovereign(SOVEREIGN_CODE_2, 6000, 1000, 3000, true);  // 5400 effective
      await configRegistry.addSovereign(SOVEREIGN_CODE_3, 9000, 3000, 2000, false); // 0 effective (disabled)

      const totalCap = await configRegistry.getTotalEffectiveCapacity();
      expect(totalCap).to.equal(11800); // 6400 + 5400 + 0
    });

    it("should prevent duplicate sovereign addition", async function () {
      await configRegistry.addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true);

      await expect(
        configRegistry.addSovereign(SOVEREIGN_CODE_1, 7000, 3000, 4000, false)
      ).to.be.revertedWithCustomError(configRegistry, "SovereignExists")
        .withArgs(SOVEREIGN_CODE_1);
    });

    it("should reject zero sovereign code", async function () {
      await expect(
        configRegistry.addSovereign(
          ethers.constants.HashZero,
          8000,
          2000,
          5000,
          true
        )
      ).to.be.revertedWithCustomError(configRegistry, "BadParam");
    });

    it("should enforce role-based access control", async function () {
      await expect(
        configRegistry.connect(user).addSovereign(SOVEREIGN_CODE_1, 8000, 2000, 5000, true)
      ).to.be.revertedWith("AccessControl");
    });
  });
});
