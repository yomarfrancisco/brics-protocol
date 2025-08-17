import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, SovereignBufferControllerV1, MezzSink } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Accrual Invariants", function () {
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

  describe("NAV Never Negative", function () {
    it("should maintain positive NAV after accrual", async function () {
      const initialSharePrice = await token.sharePrice();
      expect(initialSharePrice).to.be.gt(0);

      await token.connect(navUpdater).accruePremium(PREMIUM);

      const newSharePrice = await token.sharePrice();
      expect(newSharePrice).to.be.gt(0);
      expect(newSharePrice).to.be.gte(initialSharePrice);
    });

    it("should maintain positive NAV after multiple accruals", async function () {
      const periods = 10;
      let previousSharePrice = await token.sharePrice();

      for (let i = 0; i < periods; i++) {
        await token.connect(navUpdater).accruePremium(PREMIUM);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gt(0);
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });

    it("should maintain positive NAV with very small premiums", async function () {
      const smallPremium = ethers.parseUnits("1", 15); // 0.001 tokens
      let previousSharePrice = await token.sharePrice();

      for (let i = 0; i < 100; i++) {
        await token.connect(navUpdater).accruePremium(smallPremium);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gt(0);
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });

    it("should maintain positive NAV with very large premiums", async function () {
      const largePremium = ethers.parseUnits("100000", 18); // 100k tokens
      let previousSharePrice = await token.sharePrice();

      for (let i = 0; i < 5; i++) {
        await token.connect(navUpdater).accruePremium(largePremium);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gt(0);
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });
  });

  describe("Conservation of Value", function () {
    it("should conserve gross premium within ±1 wei", async function () {
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialMezzCredited = await mezzSink.totalCredited();

      await token.connect(navUpdater).accruePremium(PREMIUM);

      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();
      const newMezzCredited = await mezzSink.totalCredited();

      const navIncrease = newSharePrice - initialSharePrice;
      const bufferIncrease = newBufferNAV - initialBufferNAV;
      const mezzIncrease = newMezzCredited - initialMezzCredited;
      const fee = (PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;

      const totalAllocated = fee + bufferIncrease + mezzIncrease + navIncrease;
      const difference = totalAllocated > PREMIUM ? totalAllocated - PREMIUM : PREMIUM - totalAllocated;

      expect(difference).to.be.lte(1n);
    });

    it("should conserve value across multiple accruals", async function () {
      const periods = 5;
      const totalPremium = PREMIUM * BigInt(periods);
      
      let totalNavIncrease = 0n;
      let totalBufferIncrease = 0n;
      let totalMezzIncrease = 0n;
      let totalFee = 0n;

      for (let i = 0; i < periods; i++) {
        const initialSharePrice = await token.sharePrice();
        const initialBufferNAV = await bufferController.bufferNAV();
        const initialMezzCredited = await mezzSink.totalCredited();

        await token.connect(navUpdater).accruePremium(PREMIUM);

        const newSharePrice = await token.sharePrice();
        const newBufferNAV = await bufferController.bufferNAV();
        const newMezzCredited = await mezzSink.totalCredited();

        totalNavIncrease += newSharePrice - initialSharePrice;
        totalBufferIncrease += newBufferNAV - initialBufferNAV;
        totalMezzIncrease += newMezzCredited - initialMezzCredited;
        totalFee += (PREMIUM * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      }

      const totalAllocated = totalFee + totalBufferIncrease + totalMezzIncrease + totalNavIncrease;
      const difference = totalAllocated > totalPremium ? totalAllocated - totalPremium : totalPremium - totalAllocated;

      expect(difference).to.be.lte(BigInt(periods)); // Allow ±1 wei per period
    });

    it("should conserve value with different parameter combinations", async function () {
      const testCases = [
        { feeBps: 0, mezzBps: 0, bufferBps: 100 },
        { feeBps: 100, mezzBps: 0, bufferBps: 500 },
        { feeBps: 50, mezzBps: 1000, bufferBps: 300 },
        { feeBps: 200, mezzBps: 2000, bufferBps: 1000 },
      ];

      for (const testCase of testCases) {
        // Reset parameters
        await token.setProtocolFeeBps(testCase.feeBps);
        await token.setMezzShareBps(testCase.mezzBps);
        await bufferController.setBufferTargetBps(testCase.bufferBps);

        // Reset buffer
        await bufferController.updateBufferNAV(0);

        const initialSharePrice = await token.sharePrice();
        const initialBufferNAV = await bufferController.bufferNAV();
        const initialMezzCredited = await mezzSink.totalCredited();

        await token.connect(navUpdater).accruePremium(PREMIUM);

        const newSharePrice = await token.sharePrice();
        const newBufferNAV = await bufferController.bufferNAV();
        const newMezzCredited = await mezzSink.totalCredited();

        const navIncrease = newSharePrice - initialSharePrice;
        const bufferIncrease = newBufferNAV - initialBufferNAV;
        const mezzIncrease = newMezzCredited - initialMezzCredited;
        const fee = (PREMIUM * BigInt(testCase.feeBps)) / 10000n;

        const totalAllocated = fee + bufferIncrease + mezzIncrease + navIncrease;
        const difference = totalAllocated > PREMIUM ? totalAllocated - PREMIUM : PREMIUM - totalAllocated;

        expect(difference).to.be.lte(1n);
      }
    });
  });

  describe("Share Price Monotonicity", function () {
    it("should maintain non-decreasing share price with positive premium", async function () {
      const periods = 10;
      let previousSharePrice = await token.sharePrice();

      for (let i = 0; i < periods; i++) {
        await token.connect(navUpdater).accruePremium(PREMIUM);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });

    it("should maintain monotonicity with varying premium sizes", async function () {
      const premiums = [
        ethers.parseUnits("1", 15), // 0.001 tokens
        ethers.parseUnits("100", 18), // 100 tokens
        ethers.parseUnits("10000", 18), // 10k tokens
        ethers.parseUnits("100000", 18), // 100k tokens
      ];

      let previousSharePrice = await token.sharePrice();

      for (const premium of premiums) {
        await token.connect(navUpdater).accruePremium(premium);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });

    it("should maintain monotonicity with parameter changes", async function () {
      // First accrual
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterFirst = await token.sharePrice();

      // Change parameters
      await token.setProtocolFeeBps(100);
      await token.setMezzShareBps(2000);

      // Second accrual
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterSecond = await token.sharePrice();

      expect(sharePriceAfterSecond).to.be.gte(sharePriceAfterFirst);
    });
  });

  describe("Buffer Utilization", function () {
    it("should not exceed 100% buffer utilization", async function () {
      await token.connect(navUpdater).accruePremium(PREMIUM);

      const totalAssets = await token.totalAssets();
      const bufferNAV = await bufferController.bufferNAV();
      const utilizationBps = await bufferController.utilizationBps(totalAssets);

      // Utilization should be <= 100%
      expect(utilizationBps).to.be.lte(10000);
    });

    it("should maintain buffer target after multiple accruals", async function () {
      const periods = 5;

      for (let i = 0; i < periods; i++) {
        await token.connect(navUpdater).accruePremium(PREMIUM);
      }

      const totalAssets = await token.totalAssets();
      const bufferNAV = await bufferController.bufferNAV();
      const expectedTarget = (totalAssets * BigInt(BUFFER_TARGET_BPS)) / 10000n;

      // Buffer should be at or above target
      expect(bufferNAV).to.be.gte(expectedTarget);
    });
  });

  describe("State Consistency", function () {
    it("should maintain consistent state across all contracts", async function () {
      const initialTotalAssets = await token.totalAssets();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialMezzCredited = await mezzSink.totalCredited();

      await token.connect(navUpdater).accruePremium(PREMIUM);

      const finalTotalAssets = await token.totalAssets();
      const finalBufferNAV = await bufferController.bufferNAV();
      const finalMezzCredited = await mezzSink.totalCredited();

      // Total assets should increase by premium
      expect(finalTotalAssets - initialTotalAssets).to.equal(PREMIUM);

      // Buffer should be filled appropriately
      expect(finalBufferNAV).to.be.gte(initialBufferNAV);

      // Mezz should be credited appropriately
      expect(finalMezzCredited).to.be.gte(initialMezzCredited);
    });

    it("should handle concurrent parameter updates correctly", async function () {
      // Perform accrual with initial parameters
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterFirst = await token.sharePrice();

      // Update multiple parameters
      await token.setProtocolFeeBps(100);
      await token.setMezzShareBps(2000);
      await bufferController.setBufferTargetBps(500);

      // Perform another accrual
      await token.connect(navUpdater).accruePremium(PREMIUM);
      const sharePriceAfterSecond = await token.sharePrice();

      // Should still maintain monotonicity
      expect(sharePriceAfterSecond).to.be.gte(sharePriceAfterFirst);
    });
  });
});
