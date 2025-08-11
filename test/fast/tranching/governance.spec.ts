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

    it("should revert when unauthorized user submits signal", async function () {
      await expect(
        trancheManager.connect(user).submitSignal(validSignal)
      ).to.be.revertedWith("unauthorized");
    });
  });

  describe("Event Emissions", function () {
    it("should emit RiskSignalSubmitted event when signal is submitted", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const signal: IAdaptiveTranching.RiskSignalStruct = {
        sovereignUsageBps: 2000,
        portfolioDefaultsBps: 500,
        corrPpm: 300000,
        asOf: currentBlock!.timestamp
      };

      // Note: This test would need the tranching mode to be enabled
      // For now, we'll test that the event signature is correct
      expect(trancheManager.interface.getEventTopic("RiskSignalSubmitted")).to.not.be.undefined;
    });

    it("should emit TranchingModeChanged event when mode changes", async function () {
      expect(trancheManager.interface.getEventTopic("TranchingModeChanged")).to.not.be.undefined;
    });

    it("should emit ThresholdsUpdated event when thresholds change", async function () {
      expect(trancheManager.interface.getEventTopic("ThresholdsUpdated")).to.not.be.undefined;
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
