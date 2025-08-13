import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getCiSignerWallet } from "../utils/signers";

describe("Settlement Invariants", () => {
  let engine: any;
  let mockUSDC: any;
  let mockOracle: any;
  let gov: any;
  let buyer: any;
  let seller: any;
  let broker: any;
  let wallet: any;

  beforeEach(async () => {
    [gov, buyer, seller, broker] = await ethers.getSigners();
    wallet = getCiSignerWallet();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    // Deploy MockPriceOracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    mockOracle = await MockPriceOracle.deploy(await wallet.getAddress());

    // Deploy CdsSwapEngine
    const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
    engine = await CdsSwapEngine.deploy(gov.address);

    // Setup engine
    await engine.setPriceOracle(await mockOracle.getAddress());
    await engine.setSettlementToken(await mockUSDC.getAddress());
    await engine.setSettlementMode(1); // TRANSFERS mode
    await engine.grantRole(await engine.BROKER_ROLE(), broker.address);

    // Mint USDC to buyer and seller
    await mockUSDC.mint(buyer.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await mockUSDC.mint(seller.address, ethers.parseUnits("1000000", 6)); // 1M USDC

    // Approve engine to spend USDC
    await mockUSDC.connect(buyer).approve(await engine.getAddress(), ethers.parseUnits("1000000", 6));
    await mockUSDC.connect(seller).approve(await engine.getAddress(), ethers.parseUnits("1000000", 6));
  });

  describe("Token Conservation", () => {
    it("should conserve total token supply in TRANSFERS mode", async () => {
      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);
      const totalBefore = buyerBalanceBefore + sellerBalanceBefore;

      // Settle the swap
      const quote = await createValidQuote();
      await engine.settleSwap(swapId, quote, 15, 30);

      // Capture final balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);
      const totalAfter = buyerBalanceAfter + sellerBalanceAfter;

      // Verify conservation
      expect(totalAfter).to.equal(totalBefore, "Total token supply should be conserved");
    });

    it("should conserve total token supply across multiple settlements", async () => {
      // Create and activate multiple swaps
      const swapId1 = await createAndActivateSwap();
      const swapId2 = await createAndActivateSwap();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);
      const totalBefore = buyerBalanceBefore + sellerBalanceBefore;

      // Settle both swaps
      const quote1 = await createValidQuote();
      const quote2 = await createValidQuote();
      
      await engine.settleSwap(swapId1, quote1, 15, 30);
      await engine.settleSwap(swapId2, quote2, 20, 30);

      // Capture final balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);
      const totalAfter = buyerBalanceAfter + sellerBalanceAfter;

      // Verify conservation
      expect(totalAfter).to.equal(totalBefore, "Total token supply should be conserved across multiple settlements");
    });
  });

  describe("ACCOUNTING Mode", () => {
    it("should not change balances in ACCOUNTING mode", async () => {
      // Set to ACCOUNTING mode
      await engine.setSettlementMode(0);

      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Settle the swap
      const quote = await createValidQuote();
      await engine.settleSwap(swapId, quote, 15, 30);

      // Capture final balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      // Verify no changes
      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore, "Buyer balance should not change in ACCOUNTING mode");
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore, "Seller balance should not change in ACCOUNTING mode");
    });

    it("should emit events but not transfer tokens in ACCOUNTING mode", async () => {
      // Set to ACCOUNTING mode
      await engine.setSettlementMode(0);

      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Settle the swap and capture events
      const quote = await createValidQuote();
      const tx = await engine.settleSwap(swapId, quote, 15, 30);
      const receipt = await tx.wait();

      // Verify events were emitted
      const settlementEvent = receipt.logs.find((log: any) => log.fragment?.name === "SettlementExecuted");
      expect(settlementEvent).to.not.be.undefined;

      // Verify no transfer events
      const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === "Transfer");
      expect(transferEvents).to.have.length(0);

      // Verify balances unchanged
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore, "Buyer balance should not change");
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore, "Seller balance should not change");
    });
  });

  describe("Paused Engine", () => {
    it("should revert all settlement attempts when paused", async () => {
      // Pause the engine
      await engine.pause();

      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Attempt to settle - should revert
      const quote = await createValidQuote();
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "EnforcedPause");
    });

    it("should allow settlement after unpausing", async () => {
      // Pause the engine
      await engine.pause();

      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Attempt to settle - should revert
      const quote = await createValidQuote();
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "EnforcedPause");

      // Unpause the engine
      await engine.unpause();

      // Now settlement should work
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.not.be.reverted;
    });
  });

  describe("PnL Symmetry", () => {
    it("should maintain PnL symmetry: buyer gain = seller loss", async () => {
      // Create and activate a swap
      const swapId = await createAndActivateSwap();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Settle the swap
      const quote = await createValidQuote();
      const tx = await engine.settleSwap(swapId, quote, 15, 30);
      const receipt = await tx.wait();

      // Get PnL from event
      const settlementEvent = receipt.logs.find((log: any) => log.fragment?.name === "SettlementExecuted");
      const pnl = settlementEvent.args.pnlSmallest;

      // Capture final balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      // Calculate changes
      const buyerChange = buyerBalanceAfter - buyerBalanceBefore;
      const sellerChange = sellerBalanceAfter - sellerBalanceBefore;

      // Verify symmetry
      expect(buyerChange).to.equal(pnl, "Buyer change should equal PnL");
      expect(sellerChange).to.equal(-pnl, "Seller change should equal negative PnL");
      expect(buyerChange + sellerChange).to.equal(0n, "Total change should be zero");
    });
  });

  describe("Zero PnL Edge Case", () => {
    it("should handle zero PnL correctly", async () => {
      // Create and activate a swap with equal spreads (zero PnL)
      const swapId = await createAndActivateSwapWithEqualSpreads();

      // Capture initial balances
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Settle the swap
      const quote = await createValidQuoteWithEqualSpreads();
      const tx = await engine.settleSwap(swapId, quote, 15, 30);
      const receipt = await tx.wait();

      // Get PnL from event
      const settlementEvent = receipt.logs.find((log: any) => log.fragment?.name === "SettlementExecuted");
      const pnl = settlementEvent.args.pnlSmallest;

      // Verify PnL is zero
      expect(pnl).to.equal(0n, "PnL should be zero for equal spreads");

      // Capture final balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      // Verify no balance changes
      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore, "Buyer balance should not change");
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore, "Seller balance should not change");
    });
  });

  // Helper functions
  async function createAndActivateSwap() {
    const now = await time.latest();
    const startTime = now + 60;
    const maturityTime = startTime + 30 * 24 * 60 * 60;

    const swapParams = {
      portfolioId: ethers.keccak256(ethers.toUtf8Bytes("TEST-PORTFOLIO")),
      protectionBuyer: {
        counterparty: buyer.address,
        notional: ethers.parseUnits("1000000", 6),
        spreadBps: 80,
        start: startTime,
        maturity: maturityTime
      },
      protectionSeller: {
        counterparty: seller.address,
        notional: ethers.parseUnits("1000000", 6),
        spreadBps: 80,
        start: startTime,
        maturity: maturityTime
      },
      correlationBps: 2000
    };

    const tx = await engine.proposeSwap(swapParams);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => log.fragment?.name === "SwapProposed");
    const swapId = event.args.swapId;

    await engine.connect(broker).activateSwap(swapId);
    await time.increaseTo(startTime + 24 * 60 * 60);

    return swapId;
  }

  async function createAndActivateSwapWithEqualSpreads() {
    const now = await time.latest();
    const startTime = now + 60;
    const maturityTime = startTime + 30 * 24 * 60 * 60;

    const swapParams = {
      portfolioId: ethers.keccak256(ethers.toUtf8Bytes("TEST-PORTFOLIO-EQUAL")),
      protectionBuyer: {
        counterparty: buyer.address,
        notional: ethers.parseUnits("1000000", 6),
        spreadBps: 100, // Equal to fair spread
        start: startTime,
        maturity: maturityTime
      },
      protectionSeller: {
        counterparty: seller.address,
        notional: ethers.parseUnits("1000000", 6),
        spreadBps: 100, // Equal to fair spread
        start: startTime,
        maturity: maturityTime
      },
      correlationBps: 2000
    };

    const tx = await engine.proposeSwap(swapParams);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => log.fragment?.name === "SwapProposed");
    const swapId = event.args.swapId;

    await engine.connect(broker).activateSwap(swapId);
    await time.increaseTo(startTime + 24 * 60 * 60);

    return swapId;
  }

  async function createValidQuote() {
    const fairSpreadBps = 800;
    const asOf = await time.latest();
    
    const { AbiCoder, keccak256, toUtf8Bytes, getBytes } = ethers;
    const coder = new AbiCoder();
    const portfolioId = ethers.keccak256(ethers.toUtf8Bytes("TEST-PORTFOLIO"));
    
    const payload = {
      portfolioId: portfolioId,
      asOf: asOf,
      riskScore: 123456789n,
      correlationBps: 2000,
      spreadBps: fairSpreadBps,
      modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
      featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}"))
    };

    const packed = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [payload.portfolioId, payload.asOf, payload.riskScore, payload.correlationBps, payload.spreadBps, payload.modelIdHash, payload.featuresHash]
    );
    const digest = keccak256(packed);
    const signature = await wallet.signMessage(getBytes(digest));

    return {
      fairSpreadBps: fairSpreadBps,
      correlationBps: 2000,
      asOf: asOf,
      riskScore: 123456789n,
      modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
      featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
      digest: digest,
      signature: signature
    };
  }

  async function createValidQuoteWithEqualSpreads() {
    const fairSpreadBps = 100; // Equal to fixed spread
    const asOf = await time.latest();
    
    const { AbiCoder, keccak256, toUtf8Bytes, getBytes } = ethers;
    const coder = new AbiCoder();
    const portfolioId = ethers.keccak256(ethers.toUtf8Bytes("TEST-PORTFOLIO-EQUAL"));
    
    const payload = {
      portfolioId: portfolioId,
      asOf: asOf,
      riskScore: 123456789n,
      correlationBps: 2000,
      spreadBps: fairSpreadBps,
      modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
      featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}"))
    };

    const packed = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [payload.portfolioId, payload.asOf, payload.riskScore, payload.correlationBps, payload.spreadBps, payload.modelIdHash, payload.featuresHash]
    );
    const digest = keccak256(packed);
    const signature = await wallet.signMessage(getBytes(digest));

    return {
      fairSpreadBps: fairSpreadBps,
      correlationBps: 2000,
      asOf: asOf,
      riskScore: 123456789n,
      modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
      featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
      digest: digest,
      signature: signature
    };
  }
});
