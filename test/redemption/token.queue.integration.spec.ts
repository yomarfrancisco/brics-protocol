import { expect } from "chai";
import { ethers } from "hardhat";
import { RedemptionQueueV1, BRICSTokenV1, TrancheControllerV1, SovereignBufferControllerV1, MockSovereignBufferAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Token + Redemption Queue Integration", function () {
  let queue: RedemptionQueueV1;
  let token: BRICSTokenV1;
  let trancheController: TrancheControllerV1;
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
    await token.connect(owner).mintTo(user3.address, ethers.parseUnits("1000", 18));
  });

  describe("Redemption Routing", function () {
    it("should route small redemption to instant lane", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed")
        .withArgs(user1.address, SMALL_AMOUNT, Math.floor(await time.latest() / 86400), SMALL_AMOUNT);
      
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance - SMALL_AMOUNT);
    });

    it("should route large redemption to windowed queue", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      
      await expect(token.connect(user1).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
      
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance - LARGE_AMOUNT);
    });

    it("should route based on remaining daily capacity", async function () {
      // Use up most of daily limit with multiple small redemptions
      const numRedemptions = Number(DAILY_LIMIT / SMALL_AMOUNT) - 1; // Leave space for one more
      
      for (let i = 0; i < numRedemptions; i++) {
        await token.connect(user1).redeem(SMALL_AMOUNT);
      }
      
      // Small amount should still go to instant lane
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
      
      // But another small amount should go to queue since daily limit is now exhausted
      await expect(token.connect(user3).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should route based on per-transaction limit", async function () {
      // Set per-tx limit to be smaller than small amount
      await queue.setInstantLimits(DAILY_LIMIT, SMALL_AMOUNT - 1n);
      
      // Small amount should now go to queue
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should burn tokens before routing", async function () {
      const initialSupply = await token.totalSupply();
      const initialBalance = await token.balanceOf(user1.address);
      
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      const finalBalance = await token.balanceOf(user1.address);
      
      expect(finalSupply).to.equal(initialSupply - SMALL_AMOUNT);
      expect(finalBalance).to.equal(initialBalance - SMALL_AMOUNT);
    });
  });

  describe("Instant Lane Integration", function () {
    it("should complete instant redemption flow", async function () {
      const initialBuffer = await bufferController.bufferNAV();
      const initialBalance = await token.balanceOf(user1.address);
      
      await token.connect(user1).redeem(SMALL_AMOUNT);
      
      const finalBuffer = await bufferController.bufferNAV();
      const finalBalance = await token.balanceOf(user1.address);
      
      expect(finalBuffer).to.equal(initialBuffer - SMALL_AMOUNT);
      expect(finalBalance).to.equal(initialBalance - SMALL_AMOUNT);
    });

    it("should enforce daily limits across multiple users", async function () {
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

  describe("Windowed Lane Integration", function () {
    it("should complete windowed redemption flow", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      
      // Enqueue redemption
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      // Get the strike timestamp
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize window
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT);
      
      // Claim settlement
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT);
      
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance - LARGE_AMOUNT);
    });

    it("should handle partial settlement", async function () {
      const initialBalance = await token.balanceOf(user1.address);
      
      // Enqueue redemption
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      // Get the strike timestamp
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      
      // Finalize window with only 50% funds
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT / 2n);
      
      // Claim settlement
      await expect(queue.connect(user1).claim(strikeTs))
        .to.emit(queue, "WindowClaimed")
        .withArgs(user1.address, strikeTs, LARGE_AMOUNT, LARGE_AMOUNT / 2n);
      
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance - LARGE_AMOUNT);
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
  });

  describe("Stress Mode Integration", function () {
    it("should still enforce limits when stress mode is active", async function () {
      // Set very low limits to simulate stress
      await queue.setInstantLimits(SMALL_AMOUNT, SMALL_AMOUNT);
      
      // First redemption should go to instant lane
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "InstantRedeemed");
      
      // Second redemption should go to queue
      await expect(token.connect(user2).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });

    it("should handle zero instant capacity", async function () {
      // Set zero limits
      await queue.setInstantLimits(0, 0);
      
      // All redemptions should go to queue
      await expect(token.connect(user1).redeem(SMALL_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
      
      await expect(token.connect(user2).redeem(LARGE_AMOUNT))
        .to.emit(queue, "WindowEnqueued");
    });
  });

  describe("Error Handling", function () {
    it("should revert if redemption queue not set", async function () {
      // Deploy new token without queue
      const newToken = await (await ethers.getContractFactory("BRICSTokenV1")).deploy();
      await newToken.connect(owner).mintTo(user1.address, SMALL_AMOUNT);
      
      await expect(
        newToken.connect(user1).redeem(SMALL_AMOUNT)
      ).to.be.revertedWithCustomError(newToken, "ZeroAddress");
    });

    it("should revert if amount is zero", async function () {
      await expect(
        token.connect(user1).redeem(0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should revert if user has insufficient balance", async function () {
      const largeAmount = ethers.parseUnits("2000", 18);
      await expect(
        token.connect(user1).redeem(largeAmount)
      ).to.be.reverted;
    });
  });

  describe("Invariants", function () {
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

    it("should prevent double-spend in instant lane", async function () {
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

    it("should prevent double-spend in windowed lane", async function () {
      await token.connect(user1).redeem(LARGE_AMOUNT);
      
      const strikeTs = await queue.nextMonthStrikeTs(await time.latest());
      await queue.finalizeWindow(strikeTs, LARGE_AMOUNT / 2n);
      
      // User should only get 50% of their request
      await queue.connect(user1).claim(strikeTs);
      
      // Try to claim again
      await expect(
        queue.connect(user1).claim(strikeTs)
      ).to.be.revertedWithCustomError(queue, "InvalidAmount");
    });
  });
});
