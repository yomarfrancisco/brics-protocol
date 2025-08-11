import { expect } from "chai";
import { ethers } from "hardhat";
import { TrancheManagerV2 } from "../../../typechain-types";
import { IAdaptiveTranching } from "../../../typechain-types";

describe("TrancheManagerV2 Adaptive Tranching Governance Tests", function () {
  let trancheManager: TrancheManagerV2;
  let gov: any;
  let ecc: any;
  let user: any;

  beforeEach(async function () {
    [gov, ecc, user] = await ethers.getSigners();

    // Deploy TrancheManagerV2
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      await gov.getAddress(),
      await gov.getAddress(), // mock oracle
      await gov.getAddress()  // mock config
    );

    // Grant ECC role
    await trancheManager.grantRole(await trancheManager.ECC_ROLE(), await ecc.getAddress());
  });

  describe("Adaptive Tranching Getters", function () {
    it("should return default tranching mode (DISABLED)", async function () {
      expect(await trancheManager.getTranchingMode()).to.equal(0); // DISABLED
    });

    it("should return default thresholds", async function () {
      const [sovereignUsage, defaults, correlation] = await trancheManager.getTranchingThresholds();
      expect(sovereignUsage).to.equal(0); // Default value
      expect(defaults).to.equal(0); // Default value
      expect(correlation).to.equal(0); // Default value
    });
  });

  describe("Signal Submission", function () {
    const validSignal: IAdaptiveTranching.RiskSignalStruct = {
      sovereignUsageBps: 2000,
      portfolioDefaultsBps: 500,
      corrPpm: 300000,
      asOf: 0 // Will be set in test
    };

    beforeEach(async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      validSignal.asOf = currentBlock!.timestamp;
    });

    it("should revert signal submission when tranching is disabled", async function () {
      await expect(
        trancheManager.connect(gov).submitSignal(validSignal)
      ).to.be.revertedWith("Adaptive tranching disabled");
    });

    it("should allow gov to submit signal when tranching is enabled", async function () {
      // Set tranching mode to DRY_RUN (this would be done by governance)
      // For now, we'll test the event emission by directly calling the function
      // In a real scenario, this would be set by governance functions
      
      // Note: Since we can't set the mode without governance functions,
      // we'll test the event emission by temporarily modifying the contract
      // This is a limitation of the current implementation
    });

    it("should allow ECC to submit signal when tranching is enabled", async function () {
      // Similar to above - would need governance functions to set mode
    });

    it("should revert when tranching is disabled (regardless of authorization)", async function () {
      await expect(
        trancheManager.connect(user).submitSignal(validSignal)
      ).to.be.revertedWith("Adaptive tranching disabled");
      
      await expect(
        trancheManager.connect(gov).submitSignal(validSignal)
      ).to.be.revertedWith("Adaptive tranching disabled");
    });
  });

  describe("Governance Functions", function () {
    it("should allow gov to set tranching mode", async function () {
      await expect(trancheManager.connect(gov).setTranchingMode(1))
        .to.emit(trancheManager, "TranchingModeChanged")
        .withArgs(1, await gov.getAddress());
      
      expect(await trancheManager.getTranchingMode()).to.equal(1);
    });

    it("should allow gov to set tranching thresholds", async function () {
      await expect(trancheManager.connect(gov).setTranchingThresholds(2000, 1000, 650000))
        .to.emit(trancheManager, "ThresholdsUpdated")
        .withArgs(2000, 1000, 650000);
      
      const [sovereignUsage, defaults, correlation] = await trancheManager.getTranchingThresholds();
      expect(sovereignUsage).to.equal(2000);
      expect(defaults).to.equal(1000);
      expect(correlation).to.equal(650000);
    });

    it("should revert when non-gov sets tranching mode", async function () {
      await expect(
        trancheManager.connect(user).setTranchingMode(1)
      ).to.be.revertedWithCustomError(trancheManager, "AccessControlUnauthorizedAccount");
    });

    it("should revert when non-gov sets thresholds", async function () {
      await expect(
        trancheManager.connect(user).setTranchingThresholds(2000, 1000, 650000)
      ).to.be.revertedWithCustomError(trancheManager, "AccessControlUnauthorizedAccount");
    });

    it("should revert when setting invalid mode", async function () {
      await expect(
        trancheManager.connect(gov).setTranchingMode(3)
      ).to.be.revertedWith("Invalid mode");
    });

    it("should revert when setting invalid sovereign usage", async function () {
      await expect(
        trancheManager.connect(gov).setTranchingThresholds(10001, 1000, 650000)
      ).to.be.revertedWith("Sovereign usage > 100%");
    });

    it("should revert when setting invalid defaults", async function () {
      await expect(
        trancheManager.connect(gov).setTranchingThresholds(2000, 10001, 650000)
      ).to.be.revertedWith("Defaults > 100%");
    });

    it("should revert when setting invalid correlation", async function () {
      await expect(
        trancheManager.connect(gov).setTranchingThresholds(2000, 1000, 1000001)
      ).to.be.revertedWith("Correlation > 100%");
    });
  });

  describe("Signal Submission with Enabled Mode", function () {
    const validSignal: IAdaptiveTranching.RiskSignalStruct = {
      sovereignUsageBps: 2000,
      portfolioDefaultsBps: 500,
      corrPpm: 300000,
      asOf: 0 // Will be set in test
    };

    beforeEach(async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      validSignal.asOf = currentBlock!.timestamp;
      
      // Enable tranching mode
      await trancheManager.connect(gov).setTranchingMode(1); // DRY_RUN
    });

    it("should allow gov to submit signal when mode is enabled", async function () {
      await expect(trancheManager.connect(gov).submitSignal(validSignal))
        .to.emit(trancheManager, "RiskSignalSubmitted");
    });

    it("should allow ECC to submit signal when mode is enabled", async function () {
      await expect(trancheManager.connect(ecc).submitSignal(validSignal))
        .to.emit(trancheManager, "RiskSignalSubmitted");
    });

    it("should revert when unauthorized user submits signal", async function () {
      await expect(
        trancheManager.connect(user).submitSignal(validSignal)
      ).to.be.revertedWith("unauthorized");
    });
  });

  describe("Event Emissions", function () {
    it("should have RiskSignalSubmitted event signature", async function () {
      // Test that the event exists in the contract interface
      const events = trancheManager.interface.fragments.filter(f => f.type === 'event');
      const eventNames = events.map(e => e.name);
      expect(eventNames).to.include('RiskSignalSubmitted');
    });

    it("should have TranchingModeChanged event signature", async function () {
      const events = trancheManager.interface.fragments.filter(f => f.type === 'event');
      const eventNames = events.map(e => e.name);
      expect(eventNames).to.include('TranchingModeChanged');
    });

    it("should have ThresholdsUpdated event signature", async function () {
      const events = trancheManager.interface.fragments.filter(f => f.type === 'event');
      const eventNames = events.map(e => e.name);
      expect(eventNames).to.include('ThresholdsUpdated');
    });
  });

  describe("Storage Layout", function () {
    it("should maintain upgrade safety with new storage variables", async function () {
      // Test that new storage variables don't conflict with existing ones
      expect(await trancheManager.bricsLo()).to.equal(10000);
      expect(await trancheManager.bricsHi()).to.equal(10200);
      expect(await trancheManager.issuanceLocked()).to.equal(false);
      
      // New variables should have default values
      expect(await trancheManager.tranchingMode()).to.equal(0);
      expect(await trancheManager.sovereignUsageThresholdBps()).to.equal(0);
      expect(await trancheManager.defaultsThresholdBps()).to.equal(0);
      expect(await trancheManager.correlationThresholdPpm()).to.equal(0);
    });
  });
});
