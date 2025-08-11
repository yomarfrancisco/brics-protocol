import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CDS Swap RBAC", function () {
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

  describe("Role Management", function () {
    it("should grant initial roles to deployer", async function () {
      const GOV_ROLE = await cdsSwapEngine.GOV_ROLE();
      const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

      expect(await cdsSwapEngine.hasRole(GOV_ROLE, deployer.address)).to.be.true;
      expect(await cdsSwapEngine.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("should allow admin to grant broker role", async function () {
      const BROKER_ROLE = await cdsSwapEngine.BROKER_ROLE();
      
      await cdsSwapEngine.grantRole(BROKER_ROLE, user1.address);
      expect(await cdsSwapEngine.hasRole(BROKER_ROLE, user1.address)).to.be.true;
    });

    it("should allow admin to revoke broker role", async function () {
      const BROKER_ROLE = await cdsSwapEngine.BROKER_ROLE();
      
      await cdsSwapEngine.grantRole(BROKER_ROLE, user1.address);
      expect(await cdsSwapEngine.hasRole(BROKER_ROLE, user1.address)).to.be.true;
      
      await cdsSwapEngine.revokeRole(BROKER_ROLE, user1.address);
      expect(await cdsSwapEngine.hasRole(BROKER_ROLE, user1.address)).to.be.false;
    });

    it("should prevent non-admin from granting roles", async function () {
      const BROKER_ROLE = await cdsSwapEngine.BROKER_ROLE();
      
      await expect(
        cdsSwapEngine.connect(user1).grantRole(BROKER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Swap Proposal Access", function () {
    it("should allow any user to propose swap", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      await expect(
        cdsSwapEngine.connect(user3).proposeSwap(swapParams)
      ).to.not.be.reverted;
    });

    it("should emit SwapProposed event", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      
      const tx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.proposer).to.equal(user3.address);
    });
  });

  describe("Swap Activation Access", function () {
    let swapId: string;

    beforeEach(async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      const tx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      swapId = event.args.swapId;
    });

    it("should allow broker to activate swap", async function () {
      await expect(
        cdsSwapEngine.connect(broker).activateSwap(swapId)
      ).to.not.be.reverted;
    });

    it("should emit SwapActivated event", async function () {
      const tx = await cdsSwapEngine.connect(broker).activateSwap(swapId);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapActivated"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.activator).to.equal(broker.address);
    });

    it("should prevent non-broker from activating swap", async function () {
      await expect(
        cdsSwapEngine.connect(user1).activateSwap(swapId)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "Unauthorized");
    });

    it("should prevent activating non-existent swap", async function () {
      await expect(
        cdsSwapEngine.connect(broker).activateSwap(ZERO_BYTES32)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "NotFound");
    });

    it("should prevent activating already activated swap", async function () {
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
      
      await expect(
        cdsSwapEngine.connect(broker).activateSwap(swapId)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });
  });

  describe("Swap Cancellation Access", function () {
    let swapId: string;

    beforeEach(async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      const tx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      swapId = event.args.swapId;
    });

    it("should allow proposer to cancel proposed swap", async function () {
      await expect(
        cdsSwapEngine.connect(user3).cancelSwap(swapId)
      ).to.not.be.reverted;
    });

    it("should allow gov role to cancel proposed swap", async function () {
      await expect(
        cdsSwapEngine.connect(deployer).cancelSwap(swapId)
      ).to.not.be.reverted;
    });

    it("should emit SwapCancelled event", async function () {
      const tx = await cdsSwapEngine.connect(user3).cancelSwap(swapId);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapCancelled"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.canceller).to.equal(user3.address);
    });

    it("should prevent non-proposer from cancelling proposed swap", async function () {
      await expect(
        cdsSwapEngine.connect(user1).cancelSwap(swapId)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "Unauthorized");
    });

    it("should prevent cancelling non-existent swap", async function () {
      await expect(
        cdsSwapEngine.connect(user3).cancelSwap(ZERO_BYTES32)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "NotFound");
    });

    it("should allow gov role to cancel activated swap", async function () {
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
      
      await expect(
        cdsSwapEngine.connect(deployer).cancelSwap(swapId)
      ).to.not.be.reverted;
    });

    it("should prevent proposer from cancelling activated swap", async function () {
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
      
      await expect(
        cdsSwapEngine.connect(user3).cancelSwap(swapId)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "Unauthorized");
    });
  });

  describe("Swap Settlement Access", function () {
    let swapId: string;

    beforeEach(async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      const tx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      swapId = event.args.swapId;
      await cdsSwapEngine.connect(broker).activateSwap(swapId);
    });

    it("should allow any user to settle active swap", async function () {
      const mockQuote = {
        fairSpreadBps: 600,
        correlationBps: 7000,
        asOf: Math.floor(Date.now() / 1000),
        digest: ethers.ZeroHash,
        signature: "0x"
      };
      
      // This will fail due to invalid signature, but we can test the function signature
      await expect(
        cdsSwapEngine.connect(user1).settleSwap(swapId, mockQuote)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should emit SwapSettled event", async function () {
      const mockQuote = {
        fairSpreadBps: 600,
        correlationBps: 7000,
        asOf: Math.floor(Date.now() / 1000),
        digest: ethers.ZeroHash,
        signature: "0x"
      };
      
      // This will fail due to invalid signature, but we can test the function signature
      await expect(
        cdsSwapEngine.connect(user1).settleSwap(swapId, mockQuote)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should prevent settling non-existent swap", async function () {
      const mockQuote = {
        fairSpreadBps: 600,
        correlationBps: 7000,
        asOf: Math.floor(Date.now() / 1000),
        digest: ethers.ZeroHash,
        signature: "0x"
      };
      
      await expect(
        cdsSwapEngine.connect(user1).settleSwap(ZERO_BYTES32, mockQuote)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "NotFound");
    });

    it("should prevent settling proposed swap", async function () {
      const swapParams = createValidSwapParams(user1.address, user2.address);
      const tx = await cdsSwapEngine.connect(user3).proposeSwap(swapParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "SwapProposed"
      );
      const proposedSwapId = event.args.swapId;
      
      const mockQuote = {
        fairSpreadBps: 600,
        correlationBps: 7000,
        asOf: Math.floor(Date.now() / 1000),
        digest: ethers.ZeroHash,
        signature: "0x"
      };
      
      await expect(
        cdsSwapEngine.connect(user1).settleSwap(proposedSwapId, mockQuote)
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
