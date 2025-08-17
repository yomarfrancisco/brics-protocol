import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, SovereignBufferControllerV1, MezzSink } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Accrual Smoke Tests", function () {
  let token: BRICSTokenV1;
  let bufferController: SovereignBufferControllerV1;
  let mezzSink: MezzSink;
  let owner: SignerWithAddress;
  let navUpdater: SignerWithAddress;
  let user1: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1M tokens
  const PREMIUM = ethers.parseUnits("10000", 18); // 10k premium
  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const MEZZ_SHARE_BPS = 1000; // 10%
  const BUFFER_TARGET_BPS = 300; // 3%

  beforeEach(async function () {
    [owner, navUpdater, user1] = await ethers.getSigners();

    // Deploy contracts
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    const SovereignBufferControllerV1Factory = await ethers.getContractFactory("SovereignBufferControllerV1");
    bufferController = await SovereignBufferControllerV1Factory.deploy();

    const MezzSinkFactory = await ethers.getContractFactory("MezzSink");
    mezzSink = await MezzSinkFactory.deploy();

    // Set up roles
    await token.grantRole(await token.NAV_UPDATER_ROLE(), navUpdater.address);
    await bufferController.grantRole(await bufferController.BUFFER_MANAGER_ROLE(), await token.getAddress());
    await mezzSink.grantRole(await mezzSink.CREDITOR_ROLE(), await token.getAddress());

    // Wire contracts
    await token.setSovereignBufferController(await bufferController.getAddress());
    await token.setMezzSink(await mezzSink.getAddress());

    // Set parameters
    await token.setProtocolFeeBps(PROTOCOL_FEE_BPS);
    await token.setMezzShareBps(MEZZ_SHARE_BPS);
    await bufferController.setBufferTargetBps(BUFFER_TARGET_BPS);

    // Mint initial supply
    await token.mintTo(user1.address, INITIAL_SUPPLY);
  });

  describe("SMOKE: accrual fills buffer then increases NAV", function () {
    it("should complete full accrual flow", async function () {
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialMezzCredited = await mezzSink.totalCredited();
      const initialTotalAssets = await token.totalAssets();

      // Perform accrual
      await token.connect(navUpdater).accruePremium(PREMIUM);

      // Verify buffer was filled
      const newBufferNAV = await bufferController.bufferNAV();
      expect(newBufferNAV).to.be.gt(initialBufferNAV);

      // Verify mezz was credited
      const newMezzCredited = await mezzSink.totalCredited();
      expect(newMezzCredited).to.be.gt(initialMezzCredited);

      // Verify NAV increased
      const newSharePrice = await token.sharePrice();
      expect(newSharePrice).to.be.gt(initialSharePrice);

      // Verify total assets increased by premium amount
      const newTotalAssets = await token.totalAssets();
      const totalIncrease = newTotalAssets - initialTotalAssets;
      expect(totalIncrease).to.equal(PREMIUM);

      // Verify conservation of value (within rounding)
      const bufferIncrease = newBufferNAV - initialBufferNAV;
      const mezzIncrease = newMezzCredited - initialMezzCredited;
      const navIncrease = newSharePrice - initialSharePrice;
      const fee = (PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;

      const totalAllocated = fee + bufferIncrease + mezzIncrease + navIncrease;
      const difference = totalAllocated > PREMIUM ? totalAllocated - PREMIUM : PREMIUM - totalAllocated;
      expect(difference).to.be.lte(1n);
    });
  });

  describe("SMOKE: accrual fee only when buffer full", function () {
    it("should only take fee when buffer is at target", async function () {
      // First accrual fills buffer to target
      await token.connect(navUpdater).accruePremium(PREMIUM);
      
      const bufferAtTarget = await bufferController.bufferNAV();
      const sharePriceAfterFirst = await token.sharePrice();

      // Second accrual - buffer should not be topped up further
      await token.connect(navUpdater).accruePremium(PREMIUM);

      const bufferAfterSecond = await bufferController.bufferNAV();
      const sharePriceAfterSecond = await token.sharePrice();

      // Buffer should remain at target
      expect(bufferAfterSecond).to.equal(bufferAtTarget);

      // NAV should increase more in second accrual since buffer is full
      const firstNavIncrease = sharePriceAfterFirst - ethers.parseUnits("1", 18);
      const secondNavIncrease = sharePriceAfterSecond - sharePriceAfterFirst;
      
      // Second accrual should have higher NAV increase since buffer is already full
      expect(secondNavIncrease).to.be.gt(firstNavIncrease);
    });
  });

  describe("SMOKE: parameter updates affect subsequent accruals", function () {
    it("should apply new parameters to subsequent accruals", async function () {
      // First accrual with default parameters
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterFirst = await token.sharePrice();
      const mezzAfterFirst = await mezzSink.totalCredited();

      // Update parameters
      await token.setProtocolFeeBps(100); // 1% (doubled)
      await token.setMezzShareBps(2000); // 20% (doubled)

      // Second accrual with new parameters
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterSecond = await token.sharePrice();
      const mezzAfterSecond = await mezzSink.totalCredited();

      // NAV increase should be smaller due to higher fee
      const firstNavIncrease = sharePriceAfterFirst - ethers.parseUnits("1", 18);
      const secondNavIncrease = sharePriceAfterSecond - sharePriceAfterFirst;
      expect(secondNavIncrease).to.be.lt(firstNavIncrease);

      // Mezz allocation should be higher due to higher share
      const firstMezzAllocation = mezzAfterFirst;
      const secondMezzAllocation = mezzAfterSecond - mezzAfterFirst;
      expect(secondMezzAllocation).to.be.gt(firstMezzAllocation);
    });
  });

  describe("SMOKE: multiple accruals accumulate correctly", function () {
    it("should handle multiple accruals correctly", async function () {
      const periods = 5;
      let previousSharePrice = await token.sharePrice();
      let previousBufferNAV = await bufferController.bufferNAV();
      let previousMezzCredited = await mezzSink.totalCredited();

      for (let i = 0; i < periods; i++) {
        await token.connect(navUpdater).accruePremium(PREMIUM);

        const currentSharePrice = await token.sharePrice();
        const currentBufferNAV = await bufferController.bufferNAV();
        const currentMezzCredited = await mezzSink.totalCredited();

        // Verify monotonic increases
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        expect(currentBufferNAV).to.be.gte(previousBufferNAV);
        expect(currentMezzCredited).to.be.gte(previousMezzCredited);

        previousSharePrice = currentSharePrice;
        previousBufferNAV = currentBufferNAV;
        previousMezzCredited = currentMezzCredited;
      }

      // Verify total premium was conserved
      const totalPremium = PREMIUM * BigInt(periods);
      const finalTotalAssets = await token.totalAssets();
      const initialTotalAssets = INITIAL_SUPPLY; // Initial share price is 1.0
      const totalAssetsIncrease = finalTotalAssets - initialTotalAssets;
      expect(totalAssetsIncrease).to.equal(totalPremium);
    });
  });

  describe("SMOKE: edge cases handled gracefully", function () {
    it("should handle zero premium", async function () {
      await expect(
        token.connect(navUpdater).accruePremium(0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should handle very small premium", async function () {
      const smallPremium = ethers.parseUnits("1", 15); // 0.001 tokens
      
      await expect(
        token.connect(navUpdater).accruePremium(smallPremium)
      ).to.not.be.reverted;
    });

    it("should handle very large premium", async function () {
      const largePremium = ethers.parseUnits("100000", 18); // 100k tokens
      
      await expect(
        token.connect(navUpdater).accruePremium(largePremium)
      ).to.not.be.reverted;
    });
  });

  describe("SMOKE: events emitted correctly", function () {
    it("should emit PremiumAccrued event", async function () {
      await expect(token.connect(navUpdater).accruePremium(PREMIUM))
        .to.emit(token, "PremiumAccrued")
        .withArgs(
          PREMIUM,
          (PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n, // fee
          ethers.parseUnits("30000", 18), // toBuffer (3% of 1M)
          ethers.parseUnits("995", 18), // toMezz (10% of remaining after fee and buffer)
          ethers.parseUnits("8955", 18) // toTokenNav (remainder)
        );
    });

    it("should emit parameter update events", async function () {
      await expect(token.setProtocolFeeBps(100))
        .to.emit(token, "ProtocolFeeSet")
        .withArgs(100);

      await expect(token.setMezzShareBps(2000))
        .to.emit(token, "MezzShareSet")
        .withArgs(2000);

      await expect(bufferController.setBufferTargetBps(500))
        .to.emit(bufferController, "BufferTargetSet")
        .withArgs(500);
    });
  });
});
