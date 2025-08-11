import { expect } from "chai";
import { ethers } from "hardhat";
import { AdaptiveTranchingOracleAdapter } from "../../../typechain-types";
import { TrancheManagerV2 } from "../../../typechain-types";

describe("AdaptiveTranchingOracleAdapter Fast Tests", function () {
  let adapter: AdaptiveTranchingOracleAdapter;
  let trancheManager: TrancheManagerV2;
  let gov: any;
  let oracle: any;
  let user: any;

  beforeEach(async function () {
    [gov, oracle, user] = await ethers.getSigners();

    // Deploy TrancheManagerV2 first (mock for testing)
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      await gov.getAddress(),
      await gov.getAddress(), // mock oracle
      await gov.getAddress()  // mock config
    );

    // Deploy adapter
    const AdaptiveTranchingOracleAdapter = await ethers.getContractFactory("AdaptiveTranchingOracleAdapter");
    adapter = await AdaptiveTranchingOracleAdapter.deploy(
      await gov.getAddress(),
      await trancheManager.getAddress()
    );
  });

  describe("Constructor and Setup", function () {
    it("should deploy with correct roles", async function () {
      expect(await adapter.hasRole(await adapter.DEFAULT_ADMIN_ROLE(), await gov.getAddress())).to.be.true;
      expect(await adapter.hasRole(await adapter.GOV_ROLE(), await gov.getAddress())).to.be.true;
      expect(await adapter.hasRole(await adapter.ORACLE_ROLE(), await gov.getAddress())).to.be.true;
    });

    it("should set correct target contract", async function () {
      expect(await adapter.targetContract()).to.equal(await trancheManager.getAddress());
    });
  });

  describe("Role Management", function () {
    it("should allow admin to grant oracle role", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      expect(await adapter.hasOracleRole(await oracle.getAddress())).to.be.true;
    });

    it("should allow admin to revoke oracle role", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      await adapter.revokeOracleRole(await oracle.getAddress());
      expect(await adapter.hasOracleRole(await oracle.getAddress())).to.be.false;
    });

    it("should revert when non-admin grants oracle role", async function () {
      await expect(
        adapter.connect(user).grantOracleRole(await oracle.getAddress())
      ).to.be.revertedWithCustomError(adapter, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Signal Submission", function () {
    const validSignal = {
      sovereignUsageBps: 2000,
      portfolioDefaultsBps: 500,
      corrPpm: 300000,
      asOf: Math.floor(Date.now() / 1000)
    };

    it("should allow gov to submit signal", async function () {
      await adapter.connect(gov).submitSignal(validSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(validSignal.sovereignUsageBps);
      expect(lastSignal.portfolioDefaultsBps).to.equal(validSignal.portfolioDefaultsBps);
      expect(lastSignal.corrPpm).to.equal(validSignal.corrPpm);
      expect(lastSignal.asOf).to.equal(validSignal.asOf);
    });

    it("should allow oracle to submit signal", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      await adapter.connect(oracle).submitSignal(validSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(validSignal.sovereignUsageBps);
    });

    it("should revert when unauthorized user submits signal", async function () {
      await expect(
        adapter.connect(user).submitSignal(validSignal)
      ).to.be.revertedWith("unauthorized");
    });

    it("should validate sovereign usage <= 100%", async function () {
      const invalidSignal = { ...validSignal, sovereignUsageBps: 10001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("sovereign usage > 100%");
    });

    it("should validate portfolio defaults <= 100%", async function () {
      const invalidSignal = { ...validSignal, portfolioDefaultsBps: 10001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("defaults > 100%");
    });

    it("should validate correlation <= 100%", async function () {
      const invalidSignal = { ...validSignal, corrPpm: 1000001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("correlation > 100%");
    });

    it("should validate timestamp is not in future", async function () {
      const invalidSignal = { ...validSignal, asOf: Math.floor(Date.now() / 1000) + 3600 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("future timestamp");
    });
  });

  describe("Getters", function () {
    it("should return DISABLED mode when target doesn't implement", async function () {
      // Deploy adapter with non-implementing target
      const MockContract = await ethers.getContractFactory("MockUSDC");
      const mockTarget = await MockContract.deploy();
      
      const newAdapter = await (await ethers.getContractFactory("AdaptiveTranchingOracleAdapter")).deploy(
        await gov.getAddress(),
        await mockTarget.getAddress()
      );
      
      expect(await newAdapter.getTranchingMode()).to.equal(0); // DISABLED
    });

    it("should return default thresholds when target doesn't implement", async function () {
      const MockContract = await ethers.getContractFactory("MockUSDC");
      const mockTarget = await MockContract.deploy();
      
      const newAdapter = await (await ethers.getContractFactory("AdaptiveTranchingOracleAdapter")).deploy(
        await gov.getAddress(),
        await mockTarget.getAddress()
      );
      
      const [sovereignUsage, defaults, correlation] = await newAdapter.getTranchingThresholds();
      expect(sovereignUsage).to.equal(2000);
      expect(defaults).to.equal(1000);
      expect(correlation).to.equal(650000);
    });
  });
});
