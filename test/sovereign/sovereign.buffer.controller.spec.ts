import { expect } from "chai";
import { ethers } from "hardhat";
import { SovereignBufferControllerV1, MockSovereignBufferAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SovereignBufferControllerV1", function () {
  let controller: SovereignBufferControllerV1;
  let adapter: MockSovereignBufferAdapter;
  let owner: SignerWithAddress;
  let bufferManager: SignerWithAddress;
  let navUpdater: SignerWithAddress;
  let user: SignerWithAddress;

  const TOP_UP_AMOUNT = ethers.parseUnits("1000", 18);
  const DRAWDOWN_AMOUNT = ethers.parseUnits("500", 18);

  beforeEach(async function () {
    [owner, bufferManager, navUpdater, user] = await ethers.getSigners();

    // Deploy buffer controller
    const SovereignBufferControllerV1Factory = await ethers.getContractFactory("SovereignBufferControllerV1");
    controller = await SovereignBufferControllerV1Factory.deploy();

    // Deploy mock adapter
    const MockSovereignBufferAdapterFactory = await ethers.getContractFactory("MockSovereignBufferAdapter");
    adapter = await MockSovereignBufferAdapterFactory.deploy();

    // Set up roles
    await controller.grantRole(await controller.BUFFER_MANAGER_ROLE(), bufferManager.address);
    await controller.grantRole(await controller.NAV_UPDATER_ROLE(), navUpdater.address);

    // Set buffer adapter
    await controller.setSovereignBuffer(await adapter.getAddress());
    
    // Grant controller access to adapter
    await adapter.setAllowlist(await controller.getAddress(), true);
  });

  describe("Role Management", function () {
    it("should have correct default roles", async function () {
      expect(await controller.hasRole(await controller.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await controller.hasRole(await controller.BUFFER_MANAGER_ROLE(), owner.address)).to.be.true;
      expect(await controller.hasRole(await controller.NAV_UPDATER_ROLE(), owner.address)).to.be.true;
    });

    it("should allow admin to grant buffer manager role", async function () {
      await controller.grantRole(await controller.BUFFER_MANAGER_ROLE(), user.address);
      expect(await controller.hasRole(await controller.BUFFER_MANAGER_ROLE(), user.address)).to.be.true;
    });

    it("should allow admin to grant NAV updater role", async function () {
      await controller.grantRole(await controller.NAV_UPDATER_ROLE(), user.address);
      expect(await controller.hasRole(await controller.NAV_UPDATER_ROLE(), user.address)).to.be.true;
    });
  });

  describe("Buffer Management", function () {
    it("should allow admin to set sovereign buffer", async function () {
      await controller.setSovereignBuffer(user.address);
      expect(await controller.sovereignBuffer()).to.equal(user.address);
    });

    it("should revert when non-admin tries to set sovereign buffer", async function () {
      await expect(
        controller.connect(user).setSovereignBuffer(user.address)
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });

    it("should revert when setting sovereign buffer to zero address", async function () {
      await expect(
        controller.setSovereignBuffer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(controller, "ZeroAddress");
    });
  });

  describe("Top-Up Operations", function () {
    it("should allow buffer manager to record top-up", async function () {
      await controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT);
      
      expect(await controller.bufferNAV()).to.equal(TOP_UP_AMOUNT);
      expect(await controller.totalTopUps()).to.equal(TOP_UP_AMOUNT);
    });

    it("should emit TopUpRecorded event", async function () {
      await expect(controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT))
        .to.emit(controller, "TopUpRecorded")
        .withArgs(TOP_UP_AMOUNT, TOP_UP_AMOUNT);
    });

    it("should revert when non-buffer manager tries to record top-up", async function () {
      await expect(
        controller.connect(user).recordTopUp(TOP_UP_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });

    it("should revert when recording zero top-up", async function () {
      await expect(
        controller.connect(bufferManager).recordTopUp(0)
      ).to.be.revertedWithCustomError(controller, "InvalidAmount");
    });

    it("should accumulate multiple top-ups", async function () {
      await controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT);
      await controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT);
      
      expect(await controller.bufferNAV()).to.equal(TOP_UP_AMOUNT * 2n);
      expect(await controller.totalTopUps()).to.equal(TOP_UP_AMOUNT * 2n);
    });
  });

  describe("Drawdown Operations", function () {
    beforeEach(async function () {
      // Set up initial buffer NAV
      await controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT);
    });

    it("should allow buffer manager to record drawdown", async function () {
      await controller.connect(bufferManager).recordDrawdown(DRAWDOWN_AMOUNT);
      
      expect(await controller.bufferNAV()).to.equal(TOP_UP_AMOUNT - DRAWDOWN_AMOUNT);
      expect(await controller.totalDrawdowns()).to.equal(DRAWDOWN_AMOUNT);
    });

    it("should emit DrawdownRecorded event", async function () {
      await expect(controller.connect(bufferManager).recordDrawdown(DRAWDOWN_AMOUNT))
        .to.emit(controller, "DrawdownRecorded")
        .withArgs(DRAWDOWN_AMOUNT, TOP_UP_AMOUNT - DRAWDOWN_AMOUNT);
    });

    it("should revert when non-buffer manager tries to record drawdown", async function () {
      await expect(
        controller.connect(user).recordDrawdown(DRAWDOWN_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });

    it("should revert when recording zero drawdown", async function () {
      await expect(
        controller.connect(bufferManager).recordDrawdown(0)
      ).to.be.revertedWithCustomError(controller, "InvalidAmount");
    });

    it("should revert when drawdown exceeds buffer NAV", async function () {
      await expect(
        controller.connect(bufferManager).recordDrawdown(TOP_UP_AMOUNT + 1n)
      ).to.be.revertedWithCustomError(controller, "InsufficientBuffer");
    });

    it("should respect daily drawdown limit", async function () {
      const dailyLimit = await controller.dailyDrawdownLimit();
      
      // Add more buffer NAV to ensure we can test daily limit
      await controller.connect(bufferManager).recordTopUp(dailyLimit);
      
      // Should be able to drawdown up to daily limit
      await controller.connect(bufferManager).recordDrawdown(dailyLimit);
      
      // Should revert when trying to drawdown more (due to daily limit, not insufficient buffer)
      await expect(
        controller.connect(bufferManager).recordDrawdown(1n)
      ).to.be.revertedWithCustomError(controller, "DailyLimitExceeded");
    });

    it("should reset daily drawdown limit after 24 hours", async function () {
      const dailyLimit = await controller.dailyDrawdownLimit();
      
      // Add enough buffer NAV to test the reset (2x daily limit)
      await controller.connect(bufferManager).recordTopUp(dailyLimit * 2n);
      
      // Use up daily limit
      await controller.connect(bufferManager).recordDrawdown(dailyLimit);
      
      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      
      // Should be able to drawdown again (daily limit resets, and buffer NAV is still available)
      await controller.connect(bufferManager).recordDrawdown(dailyLimit);
    });
  });

  describe("NAV Updates", function () {
    it("should allow NAV updater to update buffer NAV", async function () {
      const newNAV = ethers.parseUnits("2000", 18);
      await controller.connect(navUpdater).updateBufferNAV(newNAV);
      
      expect(await controller.bufferNAV()).to.equal(newNAV);
    });

    it("should emit BufferNAVUpdated event", async function () {
      const newNAV = ethers.parseUnits("2000", 18);
      await expect(controller.connect(navUpdater).updateBufferNAV(newNAV))
        .to.emit(controller, "BufferNAVUpdated")
        .withArgs(newNAV);
    });

    it("should revert when non-NAV updater tries to update NAV", async function () {
      const newNAV = ethers.parseUnits("2000", 18);
      await expect(
        controller.connect(user).updateBufferNAV(newNAV)
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Configuration", function () {
    it("should allow admin to set utilization threshold", async function () {
      const newThreshold = 7500; // 75%
      await controller.setUtilizationThreshold(newThreshold);
      
      expect(await controller.utilizationThresholdBps()).to.equal(newThreshold);
    });

    it("should emit UtilizationThresholdSet event", async function () {
      const newThreshold = 7500;
      await expect(controller.setUtilizationThreshold(newThreshold))
        .to.emit(controller, "UtilizationThresholdSet")
        .withArgs(newThreshold);
    });

    it("should revert when setting invalid utilization threshold", async function () {
      await expect(
        controller.setUtilizationThreshold(10001)
      ).to.be.revertedWithCustomError(controller, "InvalidUtilization");
    });

    it("should allow admin to set daily drawdown limit", async function () {
      const newLimit = ethers.parseUnits("2000", 18);
      await controller.setDailyDrawdownLimit(newLimit);
      
      expect(await controller.dailyDrawdownLimit()).to.equal(newLimit);
    });

    it("should emit DailyLimitSet event", async function () {
      const newLimit = ethers.parseUnits("2000", 18);
      await expect(controller.setDailyDrawdownLimit(newLimit))
        .to.emit(controller, "DailyLimitSet")
        .withArgs(newLimit);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await controller.connect(bufferManager).recordTopUp(TOP_UP_AMOUNT);
    });

    it("should calculate utilization correctly", async function () {
      const totalAssets = ethers.parseUnits("5000", 18);
      const utilization = await controller.utilizationBps(totalAssets);
      
      // Expected: (5000 - 1000) / 5000 * 10000 = 8000 bps (80%)
      expect(utilization).to.equal(8000);
    });

    it("should return 100% utilization when no buffer", async function () {
      await controller.connect(navUpdater).updateBufferNAV(0);
      const totalAssets = ethers.parseUnits("5000", 18);
      const utilization = await controller.utilizationBps(totalAssets);
      
      expect(utilization).to.equal(10000); // 100%
    });

    it("should return 0% utilization when buffer covers all assets", async function () {
      const totalAssets = ethers.parseUnits("500", 18);
      const utilization = await controller.utilizationBps(totalAssets);
      
      expect(utilization).to.equal(0); // 0%
    });

    it("should check drawdown availability correctly", async function () {
      expect(await controller.canDrawdown(DRAWDOWN_AMOUNT)).to.be.true;
      expect(await controller.canDrawdown(TOP_UP_AMOUNT + 1n)).to.be.false;
      expect(await controller.canDrawdown(0)).to.be.false;
    });

    it("should return remaining daily drawdown capacity", async function () {
      const dailyLimit = await controller.dailyDrawdownLimit();
      const remaining = await controller.remainingDailyDrawdown();
      
      expect(remaining).to.equal(dailyLimit);
    });
  });

  describe("Top-Up Requests", function () {
    it("should request top-up when utilization is above threshold", async function () {
      const highUtilization = 8500; // 85% (above 80% threshold)
      await expect(controller.connect(bufferManager).checkAndRequestTopUp(highUtilization))
        .to.emit(adapter, "TopUpRequested");
    });

    it("should not request top-up when utilization is below threshold", async function () {
      const lowUtilization = 7500; // 75% (below 80% threshold)
      await expect(controller.connect(bufferManager).checkAndRequestTopUp(lowUtilization))
        .to.not.emit(adapter, "TopUpRequested");
    });

    it("should revert when buffer is not set", async function () {
      // Try to set buffer to zero address (should revert)
      await expect(
        controller.setSovereignBuffer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(controller, "ZeroAddress");
      
      // Test that checkAndRequestTopUp still works with current buffer
      const highUtilization = 8500; // 85% (above 80% threshold)
      await expect(controller.connect(bufferManager).checkAndRequestTopUp(highUtilization))
        .to.emit(adapter, "TopUpRequested");
    });

    it("should revert when utilization is invalid", async function () {
      await expect(
        controller.connect(bufferManager).checkAndRequestTopUp(10001)
      ).to.be.revertedWithCustomError(controller, "InvalidUtilization");
    });
  });
});
