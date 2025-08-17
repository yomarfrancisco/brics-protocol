import { expect } from "chai";
import { ethers } from "hardhat";
import { RedemptionQueueV1, BRICSTokenV1, TrancheControllerV1, SovereignBufferControllerV1, MockSovereignBufferAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Redemption Smoke Tests", function () {
  let queue: RedemptionQueueV1;
  let token: BRICSTokenV1;
  let trancheController: TrancheControllerV1;
  let bufferController: SovereignBufferControllerV1;
  let bufferAdapter: MockSovereignBufferAdapter;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const SMALL_AMOUNT = ethers.parseUnits("50", 18);
  const LARGE_AMOUNT = ethers.parseUnits("200", 18);
  const DAILY_LIMIT = ethers.parseUnits("1000", 18);
  const PER_TX_LIMIT = ethers.parseUnits("100", 18);

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    trancheController = await TrancheControllerV1Factory.deploy(await token.getAddress());

    const SovereignBufferControllerV1Factory = await ethers.getContractFactory("SovereignBufferControllerV1");
    bufferController = await SovereignBufferControllerV1Factory.deploy();

    const MockSovereignBufferAdapterFactory = await ethers.getContractFactory("MockSovereignBufferAdapter");
    bufferAdapter = await MockSovereignBufferAdapterFactory.deploy();

    const RedemptionQueueV1Factory = await ethers.getContractFactory("RedemptionQueueV1");
    queue = await RedemptionQueueV1Factory.deploy(
      owner.address,
      await token.getAddress(),
      await bufferController.getAddress(),
      DAILY_LIMIT,
      PER_TX_LIMIT
    );

    // Set up roles and wire contracts
    await token.setController(await trancheController.getAddress());
    await trancheController.setSovereignBufferController(await bufferController.getAddress());
    await token.setRedemptionQueue(await queue.getAddress());
    await bufferAdapter.setAllowlist(await bufferController.getAddress(), true);
    await bufferController.setSovereignBuffer(await bufferAdapter.getAddress());
    
    // Grant queue the buffer manager role
    await bufferController.grantRole(await bufferController.BUFFER_MANAGER_ROLE(), await queue.getAddress());

    // Add buffer NAV for testing
    await bufferController.connect(owner).recordTopUp(ethers.parseUnits("5000", 18));

    // Set tranche cap
    await trancheController.adjustSuperSeniorCap(ethers.parseUnits("10000", 18));

    // Mint tokens to users
    await token.connect(owner).mintTo(user1.address, ethers.parseUnits("1000", 18));
    await token.connect(owner).mintTo(user2.address, ethers.parseUnits("1000", 18));
  });

  describe("SMOKE redemption (instant)", function () {
    it("should complete instant redemption flow", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      const initialBuffer = await bufferController.bufferNAV();
      
      // Perform instant redemption
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed")
        .withArgs(user1.address, SMALL_AMOUNT, Math.floor(await time.latest() / 86400), SMALL_AMOUNT);
      
      // Verify token balance decreased
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance - SMALL_AMOUNT);
      
      // Verify buffer decreased
      const finalBuffer = await bufferController.bufferNAV();
      expect(finalBuffer).to.equal(initialBuffer - SMALL_AMOUNT);
      
      // Verify daily limit tracking
      const remaining = await queue.instantRemainingToday();
      expect(remaining).to.equal(DAILY_LIMIT - SMALL_AMOUNT);
    });

    it("should handle multiple instant redemptions", async function () {
      // First redemption
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      // Second redemption
      await token.connect(user2).redeem(SMALL_AMOUNT);
      
      // Verify both succeeded
      const remaining = await queue.instantRemainingToday();
      expect(remaining).to.equal(DAILY_LIMIT - (SMALL_AMOUNT * 2n));
    });

    it("should enforce daily limits", async function () {
      // Use up daily limit with multiple small redemptions
      const numRedemptions = Number(DAILY_LIMIT / SMALL_AMOUNT);
      
      for (let i = 0; i < numRedemptions; i++) {
        await token.connect(user1).redeem(SMALL_AMOUNT);
      }
      
      // Next redemption should go to queue
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should reset daily limits after 24 hours", async function () {
      // Use up most of daily limit
      await token.connect(user1).redeem(DAILY_LIMIT - SMALL_AMOUNT);
      
      // Advance time by 25 hours
      await time.increase(25 * 60 * 60);
      
      // Should be able to redeem again
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
    });
  });

  describe("SMOKE redemption (window)", function () {
    it("should complete windowed redemption flow", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      
      // Enqueue redemption
      await expect(token.connect(user1).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
      
      // Verify token balance decreased
      const balanceAfterEnqueue = await token.balanceOf(user1.address);
      expect(balanceAfterEnqueue).to.equal(initialBalance - LARGE_AMOUNT);
      
      // Get the strike timestamp
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize window
      await expect(queue.finalizeWindow(strikeTs, LARGE_AMOUNT))
        .to.emit(queue, "WindowFinalized")
        .withArgs(strikeTs, LARGE_AMOUNT, ethers.parseUnits("1", 27));
      
      // Claim settlement
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT);
    });

    it("should handle partial settlement", async function () {
      // Enqueue redemption
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize with only 50% funds
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT / 2n);
      
      // Claim settlement
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT / 2n);
    });

    it("should handle multiple users in same window", async function () {
      // Both users enqueue
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await token.connect(user2).redeem(LARGE_AMOUNT);
      
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize with 75% funds
      await queue.finalizeWindow(strikeTs, (LARGE_AMOUNT * 3n) / 2n);
      
      // Both users should get 75% of their request
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, (LARGE_AMOUNT * 3n) / 4n);
      
      await expect(queue.connect(user2).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user2.address, strikeTs, LARGE_AMOUNT, (LARGE_AMOUNT * 3n) / 4n);
    });

    it("should prevent claiming before finalization", async function () {
      // Enqueue redemption
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Try to claim before finalization
      await expect(
        queue.connect(user1).claim(strikeTs)
      ).to.be.revertedWithCustomError(queue, "WindowNotFinalized");
    });

    it("should prevent double claiming", async function () {
      // Enqueue redemption
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize and claim
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT);
      await queue.connect(user1).claim(strikeTs);
      
      // Try to claim again
      await expect(
        queue.connect(user1).claim(strikeTs)
      ).to.be.revertedWithCustomError(queue, "InvalidAmount");
    });
  });

  describe("SMOKE redemption (routing)", function () {
    it("should route small amounts to instant lane", async function () {
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
    });

    it("should route large amounts to windowed queue", async function () {
      await expect(token.connect(user1).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should route based on remaining daily capacity", async function () {
      // Use up most of daily limit with multiple small redemptions
      const numRedemptions = Number((DAILY_LIMIT - SMALL_AMOUNT) / SMALL_AMOUNT);
      
      for (let i = 0; i < numRedemptions; i++) {
        await token.connect(user1).redeem(SMALL_AMOUNT);
      }
      
      // Small amount should still go to instant lane
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
      
      // But another small amount should go to queue
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should route based on per-transaction limit", async function () {
      // Set per-tx limit to be smaller than small amount
      await queue.setInstantLimits(DAILY_LIMIT, SMALL_AMOUNT - 1n);
      
      // Small amount should now go to queue
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });
  });

  describe("SMOKE redemption (stress)", function () {
    it("should handle zero instant capacity", async function () {
      // Set zero limits
      await queue.setInstantLimits(0, 0);
      
      // All redemptions should go to queue
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
      
      await expect(token.connect(user2).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should handle very low limits", async function () {
      // Set very low limits
      await queue.setInstantLimits(SMALL_AMOUNT, SMALL_AMOUNT);
      
      // First redemption should go to instant lane
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
      
      // Second redemption should go to queue
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });
  });

  describe("SMOKE redemption (invariants)", function () {
    it("should maintain token supply consistency", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(user1).redeem(SMALL_AMOUNT);
      await token.connect(user2).redeem(LARGE_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply - SMALL_AMOUNT - LARGE_AMOUNT);
    });

    it("should maintain buffer consistency", async function () {
      const initialBuffer = await bufferController.bufferNAV();
      
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      const finalBuffer = await bufferController.bufferNAV();
      expect(finalBuffer).to.equal(initialBuffer - SMALL_AMOUNT);
    });

    it("should prevent double-spend", async function () {
      // Use up daily limit with multiple small redemptions
      const numRedemptions = Number(DAILY_LIMIT / SMALL_AMOUNT);
      
      for (let i = 0; i < numRedemptions; i++) {
        await token.connect(user1).redeem(SMALL_AMOUNT);
      }
      
      // Try to redeem more - should go to windowed queue
      await expect(
        token.connect(user2).redeem(SMALL_AMOUNT)
      ).to.emit(queue, "WindowEnqueued");
    });
  });
});

