import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CDS Swap Lifecycle", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;
  let broker: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const ZERO_ADDRESS = ethers.ZeroAddress;
  const ZERO_BYTES32 = ethers.ZeroHash;

  beforeEach(async function () {
    [deployer, broker, user1, user2, user3] = await ethers.getSigners();

    const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
    cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);

    // Grant broker role to broker
    await cdsSwapEngine.grantRole(await cdsSwapEngine.BROKER_ROLE(), broker.address);
  });

  describe("Complete Swap Lifecycle", function () {
    it("should complete full lifecycle: propose → activate → settle", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      // Step 1: Propose swap
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Verify swap was created
      expect(await cdsSwapEngine.swapExists(swapId)).to.be.true;
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(0); // Proposed
      
      // Step 2: Activate swap
      const activateTx = await cdsSwapEngine.connect(broker).activateSwap(swapId);
      const activateReceipt = await activateTx.wait();
      const activateEvent = activateReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapActivated"
      );
      
      expect(activateEvent.args.swapId).to.equal(swapId);
      expect(activateEvent.args.activator).to.equal(broker.address);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(1); // Active
      
      // Step 3: Settle swap
      const settleTx = await cdsSwapEngine.connect(user1).settleSwap(swapId);
      const settleReceipt = await settleTx.wait();
      const settleEvent = settleReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapSettled"
      );
      
      expect(settleEvent.args.swapId).to.equal(swapId);
      expect(settleEvent.args.settler).to.equal(user1.address);
      expect(settleEvent.args.pnl).to.equal(0n); // Placeholder P&L
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(2); // Settled
    });

    it("should complete lifecycle with cancellation: propose → cancel", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      // Step 1: Propose swap
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Verify swap was created
      expect(await cdsSwapEngine.swapExists(swapId)).to.be.true;
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(0); // Proposed
      
      // Step 2: Cancel swap
      const cancelTx = await cdsSwapEngine.connect(user3).cancelSwap(swapId);
      const cancelReceipt = await cancelTx.wait();
      const cancelEvent = cancelReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapCancelled"
      );
      
      expect(cancelEvent.args.swapId).to.equal(swapId);
      expect(cancelEvent.args.canceller).to.equal(user3.address);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(3); // Cancelled
    });

    it("should complete lifecycle with gov cancellation: propose → activate → cancel", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      // Step 1: Propose swap
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Step 2: Activate swap
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(1); // Active
      
      // Step 3: Cancel swap (gov role can cancel activated swaps)
      const cancelTx = await cdsSwapEngine.connect(deployer).cancelSwap(swapId);
      const cancelReceipt = await cancelTx.wait();
      const cancelEvent = cancelReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapCancelled"
      );
      
      expect(cancelEvent.args.swapId).to.equal(swapId);
      expect(cancelEvent.args.canceller).to.equal(deployer.address);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(3); // Cancelled
    });
  });

  describe("Swap Metadata", function () {
    it("should store correct metadata after proposal", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Get swap metadata
      const metadata = await cdsSwapEngine.getSwap(swapId);
      
      // Verify metadata
      expect(metadata.params.portfolioId).to.equal(swapParams.portfolioId);
      expect(metadata.params.protectionBuyer.counterparty).to.equal(swapParams.protectionBuyer.counterparty);
      expect(metadata.params.protectionSeller.counterparty).to.equal(swapParams.protectionSeller.counterparty);
      expect(metadata.params.protectionBuyer.notional).to.equal(swapParams.protectionBuyer.notional);
      expect(metadata.params.protectionBuyer.spreadBps).to.equal(swapParams.protectionBuyer.spreadBps);
      expect(metadata.params.protectionBuyer.start).to.equal(swapParams.protectionBuyer.start);
      expect(metadata.params.protectionBuyer.maturity).to.equal(swapParams.protectionBuyer.maturity);
      expect(metadata.params.correlationBps).to.equal(swapParams.correlationBps);
      expect(metadata.status).to.equal(0); // Proposed
      expect(metadata.proposer).to.equal(user3.address);
      expect(metadata.createdAt).to.be.gt(0);
    });

    it("should update status correctly through lifecycle", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Check initial status
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(0); // Proposed
      
      // Activate and check status
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(1); // Active
      
      // Settle and check status
      await cdsSwapEngine.connect(user1).settleSwap(swapId);
      expect(await cdsSwapEngine.getSwapStatus(swapId)).to.equal(2); // Settled
    });
  });

  describe("Swap ID Generation", function () {
    it("should generate unique swap IDs for different parameters", async function () {
      const swapParams1 = createValidSwapParams(user1.address, user2.address);
      const swapParams2 = createValidSwapParams(user2.address, user1.address);
      
      const tx1 = await cdsSwapEngine.connect(user3).proposeSwap(swapParams1);
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId1 = event1.args.swapId;
      
      const tx2 = await cdsSwapEngine.connect(user3).proposeSwap(swapParams2);
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId2 = event2.args.swapId;
      
      expect(swapId1).to.not.equal(swapId2);
    });

    it("should generate different swap IDs due to timestamp", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      // First proposal
      const tx1 = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId1 = event1.args.swapId;
      
      // Cancel the first swap
      await cdsSwapEngine.connect(user3).cancelSwap(swapId1);
      
      // Second proposal with identical parameters (should succeed due to different timestamp)
      const tx2 = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId2 = event2.args.swapId;
      
      // Should generate different IDs due to timestamp
      expect(swapId1).to.not.equal(swapId2);
    });
  });

  describe("Event Emission", function () {
    it("should emit all expected events in correct order", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      // Propose swap
      const proposeTx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const proposeReceipt = await proposeTx.wait();
      const proposeEvent = proposeReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const swapId = proposeEvent.args.swapId;
      
      // Verify SwapProposed event
      expect(proposeEvent.args.portfolioId).to.equal(swapParams.portfolioId);
      expect(proposeEvent.args.proposer).to.equal(user3.address);
      expect(proposeEvent.args.protectionBuyerCounterparty).to.equal(swapParams.protectionBuyer.counterparty);
      expect(proposeEvent.args.protectionSellerCounterparty).to.equal(swapParams.protectionSeller.counterparty);
      expect(proposeEvent.args.notional).to.equal(swapParams.protectionBuyer.notional);
      expect(proposeEvent.args.spreadBps).to.equal(swapParams.protectionBuyer.spreadBps);
      expect(proposeEvent.args.start).to.equal(swapParams.protectionBuyer.start);
      expect(proposeEvent.args.maturity).to.equal(swapParams.protectionBuyer.maturity);
      expect(proposeEvent.args.correlationBps).to.equal(swapParams.correlationBps);
      
      // Activate swap
      const activateTx = await cdsSwapEngine.connect(broker).activateSwap(swapId);
      const activateReceipt = await activateTx.wait();
      const activateEvent = activateReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapActivated"
      );
      
      // Verify SwapActivated event
      expect(activateEvent.args.swapId).to.equal(swapId);
      expect(activateEvent.args.activator).to.equal(broker.address);
      
      // Settle swap
      const settleTx = await cdsSwapEngine.connect(user1).settleSwap(swapId);
      const settleReceipt = await settleTx.wait();
      const settleEvent = settleReceipt.logs.find((log: any) => 
        log.fragment?.name === "SwapSettled"
      );
      
      // Verify SwapSettled event
      expect(settleEvent.args.swapId).to.equal(swapId);
      expect(settleEvent.args.settler).to.equal(user1.address);
      expect(settleEvent.args.pnl).to.equal(0n); // Placeholder P&L
    });
  });

  describe("Parameter Validation", function () {
    it("should reject invalid portfolio ID", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.portfolioId = ZERO_BYTES32;
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should reject invalid protection buyer", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.protectionBuyer.counterparty = ZERO_ADDRESS;
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should reject invalid protection seller", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.protectionSeller.counterparty = ZERO_ADDRESS;
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should reject zero notional", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.protectionBuyer.notional = 0n;
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should reject invalid start/maturity dates", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.protectionBuyer.start = swapParams.protectionBuyer.maturity;
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should reject start time in the past", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      swapParams.protectionBuyer.start = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });
  });

  function createValidSwapParams(buyer: string, seller: string) {
    return {
      portfolioId: ethers.keccak256(ethers.toUtf8Bytes("test-portfolio")),
      protectionBuyer: {
        counterparty: buyer,
        notional: ethers.parseEther("1000000"), // 1M USDC
        spreadBps: 500, // 5%
        start: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        maturity: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year from now
      },
      protectionSeller: {
        counterparty: seller,
        notional: ethers.parseEther("1000000"), // 1M USDC
        spreadBps: 500, // 5%
        start: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        maturity: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year from now
      },
      correlationBps: 7000, // 70%
    };
  }
});
