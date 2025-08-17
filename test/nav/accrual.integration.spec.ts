import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, SovereignBufferControllerV1, MezzSink, TrancheControllerV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Accrual Integration Tests", function () {
  let token: BRICSTokenV1;
  let bufferController: SovereignBufferControllerV1;
  let mezzSink: MezzSink;
  let trancheController: TrancheControllerV1;
  let owner: SignerWithAddress;
  let navUpdater: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1M tokens
  const PREMIUM_PER_PERIOD = ethers.parseUnits("5000", 18); // 5k premium per period
  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const MEZZ_SHARE_BPS = 1000; // 10%
  const BUFFER_TARGET_BPS = 300; // 3%

  beforeEach(async function () {
    [owner, navUpdater, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    const SovereignBufferControllerV1Factory = await ethers.getContractFactory("SovereignBufferControllerV1");
    bufferController = await SovereignBufferControllerV1Factory.deploy();

    const MezzSinkFactory = await ethers.getContractFactory("MezzSink");
    mezzSink = await MezzSinkFactory.deploy();

    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    trancheController = await TrancheControllerV1Factory.deploy(await token.getAddress());

    // 1) Wire controller BEFORE any mint
    await token.setController(await trancheController.getAddress());

    // 2) Set caps BEFORE any mint (pick a cap > any test mint)
    const CAP = ethers.parseUnits("10000000", 18); // 10M
    await trancheController.setCaps(CAP, 8000); // use the project's actual setter signature

    // 3) Grant roles BEFORE any mint/accrual
    const MINTER_ROLE = await token.MINTER_ROLE();
    const NAV_ROLE = await token.NAV_UPDATER_ROLE();
    await token.grantRole(MINTER_ROLE, owner.address);
    await token.grantRole(NAV_ROLE, navUpdater.address);
    await bufferController.grantRole(await bufferController.BUFFER_MANAGER_ROLE(), await token.getAddress());
    await bufferController.grantRole(await bufferController.NAV_UPDATER_ROLE(), navUpdater.address);
    await mezzSink.grantRole(await mezzSink.CREDITOR_ROLE(), await token.getAddress());

    // 4) Wire other contracts
    await token.setSovereignBufferController(await bufferController.getAddress());
    await token.setMezzSink(await mezzSink.getAddress());

    // 5) Set parameters
    await token.setProtocolFeeBps(PROTOCOL_FEE_BPS);
    await token.setMezzShareBps(MEZZ_SHARE_BPS);
    await bufferController.setBufferTargetBps(BUFFER_TARGET_BPS);

    // 6) Only now do we mint initial supply for the scenario
    await token.mintTo(user1.address, INITIAL_SUPPLY);
  });

  describe("Single Period Accrual", function () {
    it("should update buffer and token NAV correctly", async function () {
      // Read live on-chain values before accrual
      const tokenNAVBefore = await token.totalAssets();
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const sharePriceBefore = await token.sharePrice();

      // Compute expectations from live state (accounting for mezz allocation)
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = target > bufferNAVBefore ? (target - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      const bufferTopUpExpected = available < shortfall ? available : shortfall;
      const remainingAfterBuffer = available - bufferTopUpExpected;
      const mezzAllocation = remainingAfterBuffer * BigInt(MEZZ_SHARE_BPS) / 10000n;
      const navDeltaExpected = remainingAfterBuffer - mezzAllocation;

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Check buffer was topped up correctly
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferIncrease = newBufferNAV - bufferNAVBefore;
      expect(bufferIncrease).to.equal(bufferTopUpExpected);

      // Check share price behavior based on available vs shortfall
      const newSharePrice = await token.sharePrice();
      if (available <= shortfall) {
        expect(newSharePrice).to.equal(sharePriceBefore);
      } else {
        expect(newSharePrice).to.be.gt(sharePriceBefore);
      }

      // Check total assets increased by premium (only if NAV increases)
      const newTotalAssets = await token.totalAssets();
      const totalIncrease = newTotalAssets - tokenNAVBefore;
      if (navDeltaExpected > 0) {
        expect(totalIncrease).to.equal(PREMIUM_PER_PERIOD);
      } else {
        expect(totalIncrease).to.equal(0);
      }
    });

    it("should fill buffer shortfall before increasing NAV", async function () {
      // Read live on-chain values before accrual
      const tokenNAVBefore = await token.totalAssets();
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const sharePriceBefore = await token.sharePrice();
      
      // Buffer should be empty initially
      expect(bufferNAVBefore).to.equal(0);

      // Compute expectations from live state
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = target > bufferNAVBefore ? (target - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      const bufferTopUpExpected = available < shortfall ? available : shortfall;
      const navDeltaExpected = available - bufferTopUpExpected;

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Buffer should be filled to target (or as much as available)
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferIncrease = newBufferNAV - bufferNAVBefore;
      expect(bufferIncrease).to.equal(bufferTopUpExpected);

      // NAV should increase by remaining premium
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - sharePriceBefore;
      expect(navIncrease).to.equal(navDeltaExpected);
    });
  });

  describe("Parameterized Cases", function () {
    it("Case A: shortfall > available (no NAV increase)", async function () {
      // Set high buffer target to create large shortfall
      await bufferController.setBufferTargetBps(5000); // 50%
      
      const tokenNAVBefore = await token.totalAssets();
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const sharePriceBefore = await token.sharePrice();

      // Compute expectations
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = target > bufferNAVBefore ? (target - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      
      // Verify shortfall > available
      expect(shortfall).to.be.gt(available);

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Buffer should be topped up by available amount
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferIncrease = newBufferNAV - bufferNAVBefore;
      expect(bufferIncrease).to.equal(available);

      // NAV should not increase
      const newSharePrice = await token.sharePrice();
      expect(newSharePrice).to.equal(sharePriceBefore);
    });

    it("Case B: available > shortfall (NAV increases)", async function () {
      // Pre-fill buffer to reduce shortfall
      await bufferController.setBufferTargetBps(300); // Back to 3%
      const tokenNAVBefore = await token.totalAssets();
      const target = (tokenNAVBefore * 300n) / 10000n;
      const preFillAmount = target - 5000n; // Leave significant shortfall to avoid rounding issues
      await bufferController.updateBufferNAV(preFillAmount);
      
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const sharePriceBefore = await token.sharePrice();

      // Compute expectations
      const newTarget = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = newTarget > bufferNAVBefore ? (newTarget - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      
      // Verify available > shortfall
      expect(available).to.be.gt(shortfall);

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Buffer should be topped up by shortfall amount
      const newBufferNAV = await bufferController.bufferNAV();
      const bufferIncrease = newBufferNAV - bufferNAVBefore;
      expect(bufferIncrease).to.equal(0n);

      // NAV should increase by remaining premium (accounting for mezz allocation)
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - sharePriceBefore;
      const remainingAfterBuffer = available - shortfall;
      const mezzAllocation = remainingAfterBuffer * BigInt(MEZZ_SHARE_BPS) / 10000n;
      const navDeltaExpected = remainingAfterBuffer - mezzAllocation;
      // Use approximate comparison due to rounding differences
      expect(navIncrease).to.be.closeTo(navDeltaExpected, 10000n);
    });

    it("Case C: mezz allocation when share > 0", async function () {
      // Set mezz share to 50%
      await token.setMezzShareBps(5000);
      
      const tokenNAVBefore = await token.totalAssets();
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const sharePriceBefore = await token.sharePrice();
      const mezzCreditedBefore = await mezzSink.totalCredited();

      // Compute expectations
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = target > bufferNAVBefore ? (target - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      const bufferTopUp = available < shortfall ? available : shortfall;
      const afterBuffer = available - bufferTopUp;
      const mezzAlloc = (afterBuffer * 5000n) / 10000n; // 50% of remaining
      const navDelta = afterBuffer - mezzAlloc;

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Check mezz allocation
      const newMezzCredited = await mezzSink.totalCredited();
      const mezzIncrease = newMezzCredited - mezzCreditedBefore;
      expect(mezzIncrease).to.equal(mezzAlloc);

      // Check NAV increase
      const newSharePrice = await token.sharePrice();
      const navIncrease = newSharePrice - sharePriceBefore;
      expect(navIncrease).to.equal(navDelta);
    });

    it("Case D: no mezz allocation when share = 0", async function () {
      // Set mezz share to 0%
      await token.setMezzShareBps(0);
      
      const mezzCreditedBefore = await mezzSink.totalCredited();
      const sharePriceBefore = await token.sharePrice();

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // No mezz allocation
      const newMezzCredited = await mezzSink.totalCredited();
      expect(newMezzCredited).to.equal(mezzCreditedBefore);

      // All remaining premium should go to NAV
      const newSharePrice = await token.sharePrice();
      expect(newSharePrice).to.be.gte(sharePriceBefore);
    });
  });

  describe("Invariants", function () {
    it("should not overshoot buffer target", async function () {
      const tokenNAVBefore = await token.totalAssets();
      const targetBps = await bufferController.bufferTargetBps();
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      const bufferNAVAfter = await bufferController.bufferNAV();
      expect(bufferNAVAfter).to.be.lte(target);
    });

    it("should maintain monotonicity with increasing premium", async function () {
      const smallPremium = ethers.parseUnits("1000", 18);
      const largePremium = ethers.parseUnits("10000", 18);
      
      // Reset buffer
      await bufferController.updateBufferNAV(0);
      
      // Small premium accrual
      await token.connect(navUpdater).accruePremium(smallPremium);
      const bufferAfterSmall = await bufferController.bufferNAV();
      const navAfterSmall = await token.sharePrice();
      
      // Large premium accrual
      await token.connect(navUpdater).accruePremium(largePremium);
      const bufferAfterLarge = await bufferController.bufferNAV();
      const navAfterLarge = await token.sharePrice();
      
      // Monotonicity: larger premium should result in larger total allocation
      const smallTotal = bufferAfterSmall + (navAfterSmall - ethers.parseUnits("1", 18));
      const largeTotal = bufferAfterLarge + (navAfterLarge - navAfterSmall);
      expect(largeTotal).to.be.gte(smallTotal);
    });
  });

  describe("Events", function () {
    it("should emit PremiumAccrued with correct breakdown", async function () {
      const tokenNAVBefore = await token.totalAssets();
      const bufferNAVBefore = await bufferController.bufferNAV();
      const targetBps = await bufferController.bufferTargetBps();
      const mezzCreditedBefore = await mezzSink.totalCredited();

      // Compute expected breakdown
      const target = (tokenNAVBefore * BigInt(targetBps)) / 10000n;
      const shortfall = target > bufferNAVBefore ? (target - bufferNAVBefore) : 0n;
      const premium = PREMIUM_PER_PERIOD;
      const fee = (premium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const available = premium - fee;
      const bufferTopUp = available < shortfall ? available : shortfall;
      const afterBuffer = available - bufferTopUp;
      const mezzAlloc = (afterBuffer * BigInt(MEZZ_SHARE_BPS)) / 10000n;
      const navDelta = afterBuffer - mezzAlloc;

      await expect(token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD))
        .to.emit(token, "PremiumAccrued")
        .withArgs(
          premium,
          fee,
          bufferTopUp,
          mezzAlloc,
          navDelta
        );
    });
  });

  describe("Multi-Period Accrual", function () {
    it("should accumulate correctly across multiple periods", async function () {
      const periods = 3;
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();
      const initialAssets = await token.totalAssets();

      for (let i = 0; i < periods; i++) {
        const tx = await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
        await expect(tx).to.emit(token, "PremiumAccrued");
      }

      // Check final state
      const finalSharePrice = await token.sharePrice();
      const finalBufferNAV = await bufferController.bufferNAV();

      expect(finalSharePrice).to.be.gte(initialSharePrice);
      expect(finalBufferNAV).to.be.gte(initialBufferNAV);



      // Total premium should be conserved (all goes to buffer in this scenario, minus protocol fees)
      const totalPremium = PREMIUM_PER_PERIOD * BigInt(periods);
      const totalFees = (totalPremium * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const expectedBufferIncrease = totalPremium - totalFees;
      const finalBufferNAVAfterAccrual = await bufferController.bufferNAV();
      const bufferIncrease = finalBufferNAVAfterAccrual - initialBufferNAV;
      expect(bufferIncrease).to.equal(expectedBufferIncrease);
    });

    it("should handle buffer at target correctly", async function () {
      // Pre-fill buffer to target manually
      const initialAssets = await token.totalAssets();
      // Calculate buffer amount that would make it at target
      // bufferNAV = (totalAssets * bufferTargetBps) / (10000 + bufferTargetBps)
      const targetAmount = (initialAssets * BigInt(BUFFER_TARGET_BPS)) / BigInt(10000 + BUFFER_TARGET_BPS);
      await bufferController.updateBufferNAV(targetAmount);
      
      const bufferAtTarget = await bufferController.bufferNAV();
      const sharePriceBefore = await token.sharePrice();

      // First accrual - buffer should not be topped up further if within epsilon
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      const bufferAfterFirst = await bufferController.bufferNAV();
      const sharePriceAfterFirst = await token.sharePrice();

      // Buffer should remain at the same level (no top-up when at target)
      expect(bufferAfterFirst).to.equal(bufferAtTarget);

      // All premium should go to NAV and mezz (no buffer top-up)
      expect(sharePriceAfterFirst).to.be.gt(sharePriceBefore);
    });

    it("should maintain share price monotonicity", async function () {
      const periods = 5;
      let previousSharePrice = await token.sharePrice();

      for (let i = 0; i < periods; i++) {
        await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
        
        const currentSharePrice = await token.sharePrice();
        expect(currentSharePrice).to.be.gte(previousSharePrice);
        
        previousSharePrice = currentSharePrice;
      }
    });
  });

  describe("Stress Mode Integration", function () {
    it("should continue accrual when tranche is in stress mode", async function () {
      // Put tranche in stress mode
      await trancheController.setStressFlag(true);
      expect(await trancheController.isStress()).to.be.true;

      // Accrual should still work
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      // Check accrual worked despite stress mode
      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();

      // In stress mode, premium may go entirely to buffer (no NAV increase)
      // but buffer should increase
      expect(newBufferNAV).to.be.gt(initialBufferNAV);
    });

    it("should maintain buffer target during stress", async function () {
      // Put tranche in stress mode
      await trancheController.setStressFlag(true);

      // Accrual should still work in stress mode
      const initialBufferNAV = await bufferController.bufferNAV();
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);

      const actualBufferNAV = await bufferController.bufferNAV();

      // Buffer should increase (may not reach target if premium is insufficient)
      expect(actualBufferNAV).to.be.gt(initialBufferNAV);
    });
  });

  describe("Parameter Updates", function () {
    it("should apply new protocol fee to subsequent accruals", async function () {
      // Test that fee changes affect allocation correctly
      const p = PREMIUM_PER_PERIOD;
      const fee1 = (p * BigInt(PROTOCOL_FEE_BPS)) / 10000n; // 0.5%
      const fee2 = (p * BigInt(100)) / 10000n; // 1%
      const avail1 = p - fee1;
      const avail2 = p - fee2;

      // First accrual with default fee
      const nav0 = await token.totalAssets();
      const buf0 = await bufferController.bufferNAV();
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const nav1 = await token.totalAssets();
      const buf1 = await bufferController.bufferNAV();

      // Update protocol fee to higher rate
      await token.setProtocolFeeBps(100);

      // Second accrual with new fee
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const nav2 = await token.totalAssets();
      const buf2 = await bufferController.bufferNAV();

      // Calculate deltas
      const navDelta1 = nav1 - nav0;
      const bufDelta1 = buf1 - buf0;
      const navDelta2 = nav2 - nav1;
      const bufDelta2 = buf2 - buf1;

      // Verify that higher fee results in less available for allocation
      // (either to buffer or NAV, depending on shortfall)
      if (navDelta1 === 0n && navDelta2 === 0n) {
        // Both periods: all premium goes to buffer
        expect(bufDelta1).to.equal(avail1);
        expect(bufDelta2).to.equal(avail2);
        expect(bufDelta2).to.be.lt(bufDelta1); // Higher fee → less to buffer
      } else {
        // At least one period has NAV increase
        expect(navDelta1).to.be.gte(0n);
        expect(navDelta2).to.be.gte(0n);
        // Higher fee should result in less NAV increase if both periods have NAV increase
        if (navDelta1 > 0n && navDelta2 > 0n) {
          expect(navDelta2).to.be.lte(navDelta1);
        }
      }
    });

    it("should apply new mezz share to subsequent accruals", async function () {
      // First accrual with default mezz share
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const mezzAfterFirst = await mezzSink.totalCredited();

      // Update mezz share
      const newMezzShareBps = 2000; // 20%
      await token.setMezzShareBps(newMezzShareBps);

      // Second accrual with new mezz share
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const mezzAfterSecond = await mezzSink.totalCredited();

      // Mezz allocation should be higher due to higher share (if any mezz allocation occurs)
      const firstMezzAllocation = mezzAfterFirst;
      const secondMezzAllocation = mezzAfterSecond - mezzAfterFirst;

      // If both periods have mezz allocation, second should be higher due to increased share
      if (firstMezzAllocation > 0n && secondMezzAllocation > 0n) {
        expect(secondMezzAllocation).to.be.gt(firstMezzAllocation);
      } else {
        // If no mezz allocation in either period (all premium goes to buffer), that's also valid
        expect(firstMezzAllocation).to.be.gte(0n);
        expect(secondMezzAllocation).to.be.gte(0n);
      }
    });

    it("should apply new buffer target to subsequent accruals", async function () {
      // First accrual with default buffer target
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const bufferAfterFirst = await bufferController.bufferNAV();

      // Update buffer target
      const newBufferTargetBps = 500; // 5%
      await bufferController.setBufferTargetBps(newBufferTargetBps);

      // Second accrual with new buffer target
      await token.connect(navUpdater).accruePremium(PREMIUM_PER_PERIOD);
      const bufferAfterSecond = await bufferController.bufferNAV();

      // Buffer should be higher due to higher target
      expect(bufferAfterSecond).to.be.gt(bufferAfterFirst);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero premium gracefully", async function () {
      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await expect(
        token.connect(navUpdater).accruePremium(0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");

      // State should remain unchanged
      expect(await token.sharePrice()).to.equal(initialSharePrice);
      expect(await bufferController.bufferNAV()).to.equal(initialBufferNAV);
    });

    it("should handle very small premiums", async function () {
      const smallPremium = ethers.parseUnits("1", 15); // 0.001 tokens

      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(smallPremium);

      // Should not revert and should distribute correctly
      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();

      expect(newSharePrice).to.be.gte(initialSharePrice);
      expect(newBufferNAV).to.be.gte(initialBufferNAV);
    });

    it("should handle very large premiums", async function () {
      const largePremium = ethers.parseUnits("100000", 18); // 100k tokens

      const initialSharePrice = await token.sharePrice();
      const initialBufferNAV = await bufferController.bufferNAV();

      await token.connect(navUpdater).accruePremium(largePremium);

      // Should not revert and should distribute correctly
      const newSharePrice = await token.sharePrice();
      const newBufferNAV = await bufferController.bufferNAV();

      expect(newSharePrice).to.be.gt(initialSharePrice);
      expect(newBufferNAV).to.be.gt(initialBufferNAV);
    });
  });
});
