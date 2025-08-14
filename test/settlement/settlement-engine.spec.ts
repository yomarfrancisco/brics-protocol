import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { getCiSignerWallet, getCiSignerAddress } from "../utils/signers";
import { signDigestEip191 } from "../utils/signing";
import fs from "node:fs";

const anyValue = () => true;

async function deployFixture() {
  const [gov, buyer, seller, broker] = await ethers.getSigners();
  const wallet = getCiSignerWallet();

  // Increase time to a deterministic point
  await time.increase(1000);

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();

  // Deploy MockPriceOracle
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
  const mockOracle = await MockPriceOracle.deploy(await wallet.getAddress());

  // Deploy CdsSwapEngine
  const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
  const engine = await CdsSwapEngine.deploy(gov.address);

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

  return { engine, mockUSDC, mockOracle, gov, buyer, seller, broker, wallet };
}

describe("CdsSwapEngine Settlement", () => {
  let engine: any;
  let mockUSDC: any;
  let mockOracle: any;
  let gov: any;
  let buyer: any;
  let seller: any;
  let broker: any;
  let wallet: any;
  let swapId: string;

  beforeEach(async () => {
    const fixture = await loadFixture(deployFixture);
    engine = fixture.engine;
    mockUSDC = fixture.mockUSDC;
    mockOracle = fixture.mockOracle;
    gov = fixture.gov;
    buyer = fixture.buyer;
    seller = fixture.seller;
    broker = fixture.broker;
    wallet = fixture.wallet;

    // Create a swap
    const now = await time.latest();
    const startTime = now + 60; // 1 minute from now
    const maturityTime = startTime + 30 * 24 * 60 * 60; // 30 days

    const swapParams = {
      portfolioId: ethers.keccak256(ethers.toUtf8Bytes("TEST-PORTFOLIO")),
      protectionBuyer: {
        counterparty: buyer.address,
        notional: ethers.parseUnits("1000000", 6), // 1M USDC
        spreadBps: 80, // 80 bps fixed spread
        start: startTime,
        maturity: maturityTime
      },
      protectionSeller: {
        counterparty: seller.address,
        notional: ethers.parseUnits("1000000", 6), // 1M USDC
        spreadBps: 80, // 80 bps fixed spread
        start: startTime,
        maturity: maturityTime
      },
      correlationBps: 2000
    };

    const tx = await engine.proposeSwap(swapParams);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => log.fragment?.name === "SwapProposed");
    swapId = event.args.swapId;

    // Activate the swap
    await engine.connect(broker).activateSwap(swapId);

    // Advance time to after swap start
    await time.increaseTo(startTime + 24 * 60 * 60); // 1 day after start
  });

  describe("Happy Paths", () => {
    it("should settle with positive PnL (seller pays buyer)", async () => {
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Create quote with higher fair spread (seller pays buyer)
      const fairSpreadBps = 800; // 800 bps vs 80 bps fixed = 720 bps positive
      const asOf = await time.latest();
      const elapsedDays = 15;
      const tenorDays = 30;

      // Create signature
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
      const signature = await signDigestEip191(wallet, digest);

      const quote = {
        fairSpreadBps: fairSpreadBps,
        correlationBps: 2000,
        asOf: asOf,
        riskScore: 123456789n,
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
        digest: digest,
        signature: signature
      };

      // Expected PnL: (800 - 80) * 1,000,000 * 15 / (10000 * 30) = 36,000
      // But notional is in smallest units (1,000,000 * 10^6), so multiply by 10^6
      const expectedPnl = 36000000000;

      // Settle the swap
      await expect(engine.settleSwap(swapId, quote, elapsedDays, tenorDays))
        .to.emit(engine, "SettlementExecuted")
        .withArgs(swapId, buyer.address, seller.address, expectedPnl, anyValue, elapsedDays, tenorDays);

      // Check balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + BigInt(expectedPnl));
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore - BigInt(expectedPnl));
    });

    it("should settle with negative PnL (buyer pays seller)", async () => {
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Create quote with lower fair spread (buyer pays seller)
      const fairSpreadBps = 50; // 50 bps vs 80 bps fixed = -30 bps negative
      const asOf = await time.latest();
      const elapsedDays = 10;
      const tenorDays = 30;

      // Create signature
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

      const quote = {
        fairSpreadBps: fairSpreadBps,
        correlationBps: 2000,
        asOf: asOf,
        riskScore: 123456789n,
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
        digest: digest,
        signature: signature
      };

      // Expected PnL: (50 - 80) * 1,000,000 * 10 / (10000 * 30) = -10,000
      // But notional is in smallest units (1,000,000 * 10^6), so multiply by 10^6
      // (-30 * 1,000,000,000,000 * 10) / (10,000 * 30) = -1,000,000,000
      const expectedPnl = -1000000000;

      // Settle the swap
      await expect(engine.settleSwap(swapId, quote, elapsedDays, tenorDays))
        .to.emit(engine, "SettlementExecuted")
        .withArgs(swapId, buyer.address, seller.address, expectedPnl, anyValue, elapsedDays, tenorDays);

      // Check balances
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore - BigInt(-expectedPnl));
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + BigInt(-expectedPnl));
    });

    it("should settle with zero PnL (no transfer)", async () => {
      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Create quote with equal fair spread (no PnL)
      const fairSpreadBps = 80; // 80 bps vs 80 bps fixed = 0 bps
      const asOf = await time.latest();
      const elapsedDays = 12;
      const tenorDays = 30;

      // Create signature
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

      const quote = {
        fairSpreadBps: fairSpreadBps,
        correlationBps: 2000,
        asOf: asOf,
        riskScore: 123456789n,
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
        digest: digest,
        signature: signature
      };

      // Expected PnL: (80 - 80) * 1,000,000 * 12 / (10000 * 30) = 0
      const expectedPnl = 0;

      // Settle the swap
      await expect(engine.settleSwap(swapId, quote, elapsedDays, tenorDays))
        .to.emit(engine, "SettlementExecuted")
        .withArgs(swapId, buyer.address, seller.address, expectedPnl, anyValue, elapsedDays, tenorDays);

      // Check balances (should be unchanged)
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore);
    });
  });

  describe("Settlement Modes", () => {
    it("should work in ACCOUNTING mode (no transfers)", async () => {
      // Set to ACCOUNTING mode
      await engine.setSettlementMode(0); // ACCOUNTING

      const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);

      // Create quote
      const fairSpreadBps = 800;
      const asOf = await time.latest();
      const elapsedDays = 15;
      const tenorDays = 30;

      // Create signature
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

      const quote = {
        fairSpreadBps: fairSpreadBps,
        correlationBps: 2000,
        asOf: asOf,
        riskScore: 123456789n,
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
        digest: digest,
        signature: signature
      };

      // Settle the swap
      await expect(engine.settleSwap(swapId, quote, elapsedDays, tenorDays))
        .to.emit(engine, "SettlementExecuted");

      // Check balances (should be unchanged in ACCOUNTING mode)
      const buyerBalanceAfter = await mockUSDC.balanceOf(buyer.address);
      const sellerBalanceAfter = await mockUSDC.balanceOf(seller.address);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore);
    });
  });

  describe("Golden Vector Parity", () => {
    it("should match golden vectors exactly", async () => {
      const vectors = JSON.parse(
        fs.readFileSync("pricing_service/tests/golden/settlement_vectors.json", "utf8")
      );

      // Test a subset of vectors
      const testVectors = vectors.slice(0, 3); // First 3 vectors

      for (const v of testVectors) {
        // Create a new swap for each vector
        const now = await time.latest();
        const startTime = now + 60;
        const maturityTime = startTime + v.tenorDays * 24 * 60 * 60;

        const swapParams = {
          portfolioId: ethers.keccak256(ethers.toUtf8Bytes("GOLDEN-TEST")),
          protectionBuyer: {
            counterparty: buyer.address,
            notional: v.notional,
            spreadBps: v.fixedSpreadBps,
            start: startTime,
            maturity: maturityTime
          },
          protectionSeller: {
            counterparty: seller.address,
            notional: v.notional,
            spreadBps: v.fixedSpreadBps,
            start: startTime,
            maturity: maturityTime
          },
          correlationBps: 2000
        };

        const tx = await engine.proposeSwap(swapParams);
        const receipt = await tx.wait();
        const event = receipt.logs.find((log: any) => log.fragment?.name === "SwapProposed");
        const testSwapId = event.args.swapId;

        await engine.connect(broker).activateSwap(testSwapId);
        await time.increaseTo(startTime + v.elapsedDays * 24 * 60 * 60);

        // Create quote
        const asOf = await time.latest();
        const { AbiCoder, keccak256, toUtf8Bytes, getBytes } = ethers;
        const coder = new AbiCoder();
        const portfolioId = ethers.keccak256(ethers.toUtf8Bytes("GOLDEN-TEST"));
        
        const payload = {
          portfolioId: portfolioId,
          asOf: asOf,
          riskScore: 123456789n,
          correlationBps: 2000,
          spreadBps: v.fairSpreadBps,
          modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
          featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}"))
        };

        const packed = coder.encode(
          ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
          [payload.portfolioId, payload.asOf, payload.riskScore, payload.correlationBps, payload.spreadBps, payload.modelIdHash, payload.featuresHash]
        );
        const digest = keccak256(packed);
        const signature = await wallet.signMessage(getBytes(digest));

        const quote = {
          fairSpreadBps: v.fairSpreadBps,
          correlationBps: 2000,
          asOf: asOf,
          riskScore: 123456789n,
          modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("MODEL-V1")),
          featuresHash: ethers.keccak256(ethers.toUtf8Bytes("{}")),
          digest: digest,
          signature: signature
        };

        // Settle and check PnL matches golden vector
        await expect(engine.settleSwap(testSwapId, quote, v.elapsedDays, v.tenorDays))
          .to.emit(engine, "SettlementExecuted")
          .withArgs(testSwapId, buyer.address, seller.address, v.expectedPnlSmallest, anyValue, v.elapsedDays, v.tenorDays);
      }
    });
  });

  describe("Failure Cases", () => {
    it("should revert with invalid elapsed days", async () => {
      const quote = await createValidQuote();
      
      await expect(engine.settleSwap(swapId, quote, 0, 30))
        .to.be.revertedWithCustomError(engine, "InvalidParams")
        .withArgs("Invalid elapsed/tenor days");

      await expect(engine.settleSwap(swapId, quote, 31, 30))
        .to.be.revertedWithCustomError(engine, "InvalidParams")
        .withArgs("Invalid elapsed/tenor days");
    });

    it("should revert with invalid tenor days", async () => {
      const quote = await createValidQuote();
      
      await expect(engine.settleSwap(swapId, quote, 15, 36501))
        .to.be.revertedWithCustomError(engine, "InvalidParams")
        .withArgs("Invalid elapsed/tenor days");
    });

    it("should revert with invalid fair spread", async () => {
      const quote = await createValidQuote();
      quote.fairSpreadBps = 0; // Invalid: below MIN_SPREAD_BPS
      
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "InvalidParams")
        .withArgs("Invalid quote signature");

      quote.fairSpreadBps = 10001; // Invalid: above MAX_SPREAD_BPS
      
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "InvalidParams")
        .withArgs("Invalid quote signature");
    });

    it("should revert when paused", async () => {
      await engine.pause();
      
      const quote = await createValidQuote();
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "EnforcedPause");
    });

    it("should revert with invalid signature", async () => {
      const quote = await createValidQuote();
      quote.signature = "0x" + "00".repeat(65); // Invalid signature
      
      await expect(engine.settleSwap(swapId, quote, 15, 30))
        .to.be.revertedWithCustomError(engine, "ECDSAInvalidSignature");
    });
  });

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
});
