import { expect } from "chai";
import { ethers } from "hardhat";
import { RedemptionQueueV1, BRICSTokenV1, SovereignBufferControllerV1, MockSovereignBufferAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RedemptionQueueV1", function () {
  let queue: RedemptionQueueV1;
  let token: BRICSTokenV1;
  let bufferController: SovereignBufferControllerV1;
  let bufferAdapter: MockSovereignBufferAdapter;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const SMALL_AMOUNT = ethers.parseUnits("50", 18);
  const LARGE_AMOUNT = ethers.parseUnits("200", 18);
  const DAILY_LIMIT = ethers.parseUnits("1000", 18);
  const PER_TX_LIMIT = ethers.parseUnits("100", 18);

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy contracts
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

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
    await bufferAdapter.setAllowlist(await bufferController.getAddress(), true);
    await bufferController.setSovereignBuffer(await bufferAdapter.getAddress());
    
    // Grant queue the buffer manager role
    await bufferController.grantRole(await bufferController.BUFFER_MANAGER_ROLE(), await queue.getAddress());
    
    // Set redemption queue on token
    await token.setRedemptionQueue(await queue.getAddress());

    // Add buffer NAV for testing
    await bufferController.connect(owner).recordTopUp(ethers.parseUnits("5000", 18));

    // Mint tokens to users
    await token.connect(owner).mintTo(user1.address, ethers.parseUnits("1000", 18));
    await token.connect(owner).mintTo(user2.address, ethers.parseUnits("1000", 18));
    await token.connect(owner).mintTo(user3.address, ethers.parseUnits("1000", 18));
  });

  describe("Configuration", function () {
    it("should have correct default limits", async function () {
      expect(await queue.instantDailyLimit()).to.equal(DAILY_LIMIT);
      expect(await queue.instantPerTxLimit()).to.equal(PER_TX_LIMIT);
    });

    it("should allow admin to set instant limits", async function () {
      const newDailyLimit = ethers.parseUnits("2000", 18);
      const newPerTxLimit = ethers.parseUnits("200", 18);
      
      await queue.setInstantLimits(newDailyLimit, newPerTxLimit);
      
      expect(await queue.instantDailyLimit()).to.equal(newDailyLimit);
      expect(await queue.instantPerTxLimit()).to.equal(newPerTxLimit);
    });

    it("should emit LimitsSet event", async function () {
      const newDailyLimit = ethers.parseUnits("2000", 18);
      const newPerTxLimit = ethers.parseUnits("200", 18);
      
      await expect(queue.setInstantLimits(newDailyLimit, newPerTxLimit))
        .to.emit(queue, "LimitsSet")
        .withArgs(newDailyLimit, newPerTxLimit);
    });
  });

  describe("Instant Lane", function () {
    it("should allow small instant redemption", async function () {
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed")
        .withArgs(user1.address, SMALL_AMOUNT, Math.floor(await time.latest() / 86400), SMALL_AMOUNT);
    });

    it("should enforce per-transaction limit", async function () {
      // Amount larger than per-tx limit should go to windowed queue
      await expect(token.connect(user1).redeem(PER_TX_LIMIT + 1n))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should enforce daily limit", async function () {
      // Use up daily limit by making multiple small redemptions
      const smallRedemption = ethers.parseUnits("50", 18);
      const numRedemptions = Number(DAILY_LIMIT / smallRedemption);
      
      for (let i = 0; i < numRedemptions; i++) {
        await token.connect(user1).redeem(smallRedemption);
      }
      
      // Check that daily limit is exhausted
      const remaining = await queue.instantRemainingToday();
      expect(remaining).to.equal(0);
      
      // Try to redeem more - should go to windowed queue
      await expect(token.connect(user2).redeem(1n))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should reset daily limit after 24 hours", async function () {
      // Use up most of daily limit
      await token.connect(user1).redeem(DAILY_LIMIT - SMALL_AMOUNT);
      
      // Advance time by 25 hours
      await time.increase(25 * 60 * 60);
      
      // Should be able to redeem again
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
    });

    it("should track daily spending correctly", async function () {
      await token.connect(user1).redeem(SMALL_AMOUNT);
      await token.connect(user2).redeem(SMALL_AMOUNT);
      
      const dayIndex = await queue.currentDayIndex();
      const spent = await queue.instantSpentByDay(dayIndex);
      expect(spent).to.equal(SMALL_AMOUNT * 2n);
    });

    it("should calculate remaining capacity correctly", async function () {
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      const remaining = await queue.instantRemainingToday();
      expect(remaining).to.equal(DAILY_LIMIT - SMALL_AMOUNT);
    });
  });

  describe("Windowed Lane", function () {
    let strikeTs: bigint;

    beforeEach(async function () {
      // Get the next month strike timestamp from the contract
      const currentTs = await time.latest();
      strikeTs = await queue.nextMonthStrikeTs(currentTs);
    });

    it("should enqueue redemption requests", async function () {
      await expect(token.connect(user1).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT);
    });

    it("should track multiple requests in same window", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await token.connect(user2).redeem(LARGE_AMOUNT);
      
      const window = await queue.windows(strikeTs);
      expect(window.totalRequested).to.equal(LARGE_AMOUNT * 2n);
    });

    it("should prevent enqueueing after window finalized", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT);
      
      await expect(
        token.connect(user2).redeem(LARGE_AMOUNT)
      ).to.be.revertedWithCustomError(queue, "WindowFinalizedAlready");
    });

    it("should finalize window with settlement factor", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const fundsProvided = LARGE_AMOUNT; // 100% settlement
      await expect(queue.finalizeWindow(strikeTs, fundsProvided))
        .to.emit(queue, "WindowFinalized")
        .withArgs(strikeTs, fundsProvided, ethers.parseUnits("1", 27)); // 100% in RAY
    });

    it("should calculate partial settlement correctly", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const fundsProvided = LARGE_AMOUNT / 2n; // 50% settlement
      await queue.finalizeWindow(strikeTs, fundsProvided);
      
      const window = await queue.windows(strikeTs);
      expect(window.settlementRay).to.equal(ethers.parseUnits("0.5", 27)); // 50% in RAY
    });

    it("should allow users to claim settlement", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT);
      
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT);
    });

    it("should prevent claiming before finalization", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      await expect(
        queue.connect(user1).claim(strikeTs)
      ).to.be.revertedWithCustomError(queue, "WindowNotFinalized");
    });

    it("should prevent double claiming", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT);
      
      await queue.connect(user1).claim(strikeTs);
      
      await expect(
        queue.connect(user1).claim(strikeTs)
      ).to.be.revertedWithCustomError(queue, "InvalidAmount");
    });

    it("should handle zero settlement correctly", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      await queue.finalizeWindow(strikeTs, 0);
      
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, 0);
    });
  });

  describe("Utility Functions", function () {
    it("should calculate next month strike correctly", async function () {
      const currentTs = await time.latest();
      const nextStrike = await queue.nextMonthStrikeTs(currentTs);
      
      // Should be next 30-day boundary
      const thirtyDaysInSeconds = 30n * 24n * 60n * 60n;
      expect(nextStrike % thirtyDaysInSeconds).to.equal(0n);
      expect(nextStrike).to.be.gt(currentTs);
    });

    it("should calculate day index correctly", async function () {
      const currentTs = await time.latest();
      const dayIndex = await queue.currentDayIndex();
      const expectedDayIndex = BigInt(Math.floor(Number(currentTs) / (24 * 60 * 60)));
      expect(dayIndex).to.equal(expectedDayIndex);
    });
  });

  describe("Invariants", function () {
    it("should maintain buffer >= 0", async function () {
      const initialBuffer = await bufferController.bufferNAV();
      
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      const finalBuffer = await bufferController.bufferNAV();
      expect(finalBuffer).to.be.gte(0);
      expect(finalBuffer).to.equal(initialBuffer - SMALL_AMOUNT);
    });

    it("should prevent double-spend in instant lane", async function () {
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      // Try to redeem more than daily limit - should go to windowed queue
      await expect(
        token.connect(user2).redeem(DAILY_LIMIT)
      ).to.emit(queue, "WindowEnqueued");
    });

    it("should prevent double-spend in windowed lane", async function () {
      // Enqueue the user in the window and capture the strike timestamp from the event
      const tx = await token.connect(user1).redeem(LARGE_AMOUNT);
      const receipt = await tx.wait();
      
      // Find the WindowEnqueued event to get the actual strike timestamp
      const event = receipt?.logs.find(log => {
        try {
          const parsed = queue.interface.parseLog(log);
          return parsed?.name === "WindowEnqueued";
        } catch {
          return false;
        }
      });
      
      if (!event) {
        throw new Error("WindowEnqueued event not found");
      }
      
      const parsedEvent = queue.interface.parseLog(event);
      const strikeTs = parsedEvent?.args[1]; // strikeTs is the second argument
      
      // Finalize the window with only 50% funds available
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT / 2n);
      
      // User should be able to claim
      await queue.connect(user1).claim(strikeTs);
      
      // User should only get 50% of their request
      const window = await queue.windows(strikeTs);
      expect(window.settlementRay).to.equal(ethers.parseUnits("0.5", 27));
    });
  });

  describe("Access Control", function () {
    it("should only allow token to call redeemSmallAfterBurn", async function () {
      await expect(
        queue.connect(user1).redeemSmallAfterBurn(user1.address, SMALL_AMOUNT)
      ).to.be.reverted;
    });

    it("should only allow token to call enqueueAfterBurn", async function () {
      await expect(
        queue.connect(user1).enqueueAfterBurn(user1.address, LARGE_AMOUNT, 30 * 24 * 60 * 60)
      ).to.be.reverted;
    });

    it("should only allow settler to finalize window", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      await expect(
        queue.connect(user1).finalizeWindow(30 * 24 * 60 * 60, LARGE_AMOUNT)
      ).to.be.reverted;
    });

    it("should only allow limits role to set limits", async function () {
      await expect(
        queue.connect(user1).setInstantLimits(DAILY_LIMIT, PER_TX_LIMIT)
      ).to.be.reverted;
    });
  });
});
