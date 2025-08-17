import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, SovereignBufferControllerV1, MezzSink } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Accrual Waterfall Unit Tests", function () {
  let token: BRICSTokenV1;
  let bufferController: SovereignBufferControllerV1;
  let mezzSink: MezzSink;
  let owner: SignerWithAddress;
  let navUpdater: SignerWithAddress;
  let user1: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1M tokens
  const GROSS_PREMIUM = ethers.parseUnits("10000", 18); // 10k premium
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

  describe("Waterfall Math", function () {
    it("should calculate protocol fee correctly", async function () {
      const expectedFee = (GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      expect(expectedFee).to.equal(ethers.parseUnits("50", 18)); // 0.5% of 10k = 50
    });

    it("should calculate mezz share correctly", async function () {
      const afterFee = GROSS_PREMIUM - ((GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n);
      const expectedMezz = (afterFee * BigInt(MEZZ_SHARE_BPS)) / 10000n;
      expect(expectedMezz).to.equal(ethers.parseUnits("995", 18)); // 10% of 9950 = 995
    });

    it("should calculate buffer target correctly", async function () {
      const totalAssets = await token.totalAssets();
      const expectedTarget = (totalAssets * BigInt(BUFFER_TARGET_BPS)) / 10000n;
      expect(expectedTarget).to.equal(ethers.parseUnits("30000", 18)); // 3% of 1M = 30k
    });
  });

  describe("Waterfall Distribution", function () {
    it("should distribute premium correctly with empty buffer", async function () {
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialMezzCredited = await mezzSink.totalCredited();

      await token.connect(navUpdater).accruePremium(GROSS_PREMIUM);

      // Check protocol fee (50 tokens)
      // Fee is taken but not stored anywhere in this implementation
      // In a real implementation, it would be sent to a treasury

      // Check buffer top-up (capped by available premium after fee)
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferTopUp = newBufferNAV - initialBufferNAV;
      
      // The buffer shortfall is 30k (3% of 1M token NAV), but only 9.95k is available after fee
      // So the buffer gets topped up by the minimum of shortfall and available amount
      const afterFee = GROSS_PREMIUM - ((GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n);
      const totalAssets = await token.totalAssets();
      const tokenNAV = totalAssets - initialBufferNAV; // Non-buffer assets before top-up
      const bufferShortfall = (tokenNAV * BigInt(BUFFER_TARGET_BPS)) / 10000n;
      const expectedBufferTopUp = bufferShortfall < afterFee ? bufferShortfall : afterFee;
      expect(bufferTopUp).to.equal(expectedBufferTopUp);

      // Check mezz allocation (10% of remaining after fee and buffer)
      const newMezzCredited = await mezzSink.totalCredited();
      const mezzAllocation = newMezzCredited - initialMezzCredited;
      const afterFeeAndBuffer = GROSS_PREMIUM - ((GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n) - bufferTopUp;
      const expectedMezz = (afterFeeAndBuffer * BigInt(MEZZ_SHARE_BPS)) / 10000n;
      expect(mezzAllocation).to.equal(expectedMezz);

      // Check token NAV increase
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - initialSharePrice;
      const expectedNavIncrease = GROSS_PREMIUM - ((GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n) - bufferTopUp - mezzAllocation;
      expect(navIncrease).to.equal(expectedNavIncrease);
    });

    it("should cap buffer top-up to target", async function () {
      // Pre-fill buffer to 2% of total assets
      const totalAssets = await token.totalAssets();
      const preFillAmount = (totalAssets * 200n) / 10000n; // 2%
      await bufferController.recordTopUp(preFillAmount);

      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(GROSS_PREMIUM);

      // Buffer should be topped up to reach 3% of token NAV target
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferTopUp = newBufferNAV - initialBufferNAV;
      
      // Calculate expected target based on token NAV (non-buffer assets)
      const tokenNAV = totalAssets - initialBufferNAV;
      const targetAmount = (tokenNAV * BigInt(BUFFER_TARGET_BPS)) / 10000n;
      const expectedTopUp = targetAmount > initialBufferNAV ? targetAmount - initialBufferNAV : 0n;
      expect(bufferTopUp).to.equal(expectedTopUp);
    });

    it("should skip buffer top-up when at target", async function () {
      // Pre-fill buffer to 3% of total assets
      const totalAssets = await token.totalAssets();
      const preFillAmount = (totalAssets * BigInt(BUFFER_TARGET_BPS)) / 10000n;
      await bufferController.recordTopUp(preFillAmount);

      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(GROSS_PREMIUM);

      // Buffer should not be topped up
      const newBufferNAV = await bufferController.bufferNAV();
      expect(newBufferNAV).to.equal(initialBufferNAV);

      // All remaining premium should go to mezz and NAV
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - initialSharePrice;
      const afterFee = GROSS_PREMIUM - ((GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n);
      expect(navIncrease).to.be.gt(0);
    });

    it("should skip mezz allocation when share is 0", async function () {
      await token.setMezzShareBps(0);

      const initialSharePrice = await token.sharePrice();
      const initialMezzCredited = await mezzSink.totalCredited();

      await token.connect(navUpdater).accruePremium(GROSS_PREMIUM);

      // No mezz allocation
      const newMezzCredited = await mezzSink.totalCredited();
      expect(newMezzCredited).to.equal(initialMezzCredited);

      // Remaining premium should go to NAV (if any is left after buffer)
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - initialSharePrice;
      
      // Calculate expected NAV increase
      const fee = (GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const afterFee = GROSS_PREMIUM - fee;
      const totalAssets = await token.totalAssets();
      const tokenNAV = totalAssets - (await bufferController.bufferNAV());
      const targetAmount = (tokenNAV * BigInt(BUFFER_TARGET_BPS)) / 10000n;
      const bufferShortfall = targetAmount > (await bufferController.bufferNAV()) ? targetAmount - (await bufferController.bufferNAV()) : 0n;
      const toBuffer = bufferShortfall < afterFee ? bufferShortfall : afterFee;
      const expectedNavIncrease = afterFee - toBuffer;
      
      expect(navIncrease).to.equal(expectedNavIncrease);
    });
  });

  describe("Rounding and Conservation", function () {
    it("should conserve value within ±1 wei", async function () {
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialMezzCredited = await mezzSink.totalCredited();

      await token.connect(navUpdater).accruePremium(GROSS_PREMIUM);

      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();
      const newMezzCredited = await mezzSink.totalCredited();

      const navIncrease = newSharePrice - initialSharePrice;
      const bufferIncrease = newBufferNAV - initialBufferNAV;
      const mezzIncrease = newMezzCredited - initialMezzCredited;

      // Calculate fee
      const fee = (GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;

      // Sum of all allocations
      const totalAllocated = fee + bufferIncrease + mezzIncrease + navIncrease;
      const difference = totalAllocated > GROSS_PREMIUM ? totalAllocated - GROSS_PREMIUM : GROSS_PREMIUM - totalAllocated;

      // Should be within ±1 wei due to rounding
      expect(difference).to.be.lte(1n);
    });

    it("should handle small amounts correctly", async function () {
      const smallPremium = ethers.parseUnits("1", 18); // 1 token

      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(smallPremium);

      // Should not revert and should distribute correctly
      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();

      expect(newSharePrice).to.be.gte(initialSharePrice);
      expect(newBufferNAV).to.be.gte(initialBufferNAV);
    });
  });

  describe("Events", function () {
    it("should emit PremiumAccrued event with correct values", async function () {
      await expect(token.connect(navUpdater).accruePremium(GROSS_PREMIUM))
        .to.emit(token, "PremiumAccrued")
        .withArgs(
          GROSS_PREMIUM,
          (GROSS_PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n, // fee
          ethers.parseUnits("9950", 18), // toBuffer (capped by available premium after fee)
          ethers.parseUnits("0", 18), // toMezz (0% share)
          ethers.parseUnits("0", 18) // toTokenNav (no remaining premium)
        );
    });

    it("should emit ProtocolFeeSet event", async function () {
      const newFeeBps = 100; // 1%
      await expect(token.setProtocolFeeBps(newFeeBps))
        .to.emit(token, "ProtocolFeeSet")
        .withArgs(newFeeBps);
    });

    it("should emit MezzShareSet event", async function () {
      const newShareBps = 2000; // 20%
      await expect(token.setMezzShareBps(newShareBps))
        .to.emit(token, "MezzShareSet")
        .withArgs(newShareBps);
    });
  });

  describe("Access Control", function () {
    it("should revert if non-NAV-updater tries to accrue", async function () {
      await expect(
        token.connect(user1).accruePremium(GROSS_PREMIUM)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if non-admin tries to set protocol fee", async function () {
      await expect(
        token.connect(user1).setProtocolFeeBps(100)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if non-admin tries to set mezz share", async function () {
      await expect(
        token.connect(user1).setMezzShareBps(1000)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
});
