import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, TrancheControllerV1, SovereignBufferControllerV1, MockSovereignBufferAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Token + Buffer Integration", function () {
  let token: BRICSTokenV1;
  let trancheController: TrancheControllerV1;
  let bufferController: SovereignBufferControllerV1;
  let bufferAdapter: MockSovereignBufferAdapter;
  let owner: SignerWithAddress;
  let bufferManager: SignerWithAddress;
  let navUpdater: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const MINT_AMOUNT = ethers.parseUnits("1000", 18);
  const ACCRUAL_AMOUNT = ethers.parseUnits("100", 18);
  const BUFFER_TOP_UP = ethers.parseUnits("500", 18);

  beforeEach(async function () {
    [owner, bufferManager, navUpdater, user1, user2] = await ethers.getSigners();

    // Deploy token
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Deploy tranche controller
    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    trancheController = await TrancheControllerV1Factory.deploy(await token.getAddress());

    // Deploy buffer controller
    const SovereignBufferControllerV1Factory = await ethers.getContractFactory("SovereignBufferControllerV1");
    bufferController = await SovereignBufferControllerV1Factory.deploy();

    // Deploy buffer adapter
    const MockSovereignBufferAdapterFactory = await ethers.getContractFactory("MockSovereignBufferAdapter");
    bufferAdapter = await MockSovereignBufferAdapterFactory.deploy();

    // Set up roles
    await token.grantRole(await token.MINTER_ROLE(), owner.address);
    await token.grantRole(await token.NAV_UPDATER_ROLE(), navUpdater.address);
    await bufferController.grantRole(await bufferController.BUFFER_MANAGER_ROLE(), bufferManager.address);
    await bufferController.grantRole(await bufferController.NAV_UPDATER_ROLE(), navUpdater.address);

    // Wire controllers
    await token.setController(await trancheController.getAddress());
    await trancheController.setSovereignBufferController(await bufferController.getAddress());
    await bufferController.setSovereignBuffer(await bufferAdapter.getAddress());
    
    // Grant controller access to adapter
    await bufferAdapter.setAllowlist(await bufferController.getAddress(), true);

    // Set initial cap
    await trancheController.adjustSuperSeniorCap(ethers.parseUnits("10000", 18));
  });

  describe("NAV Accrual Path", function () {
    it("should accrue NAV to token and update buffer NAV", async function () {
      // Initial state
      expect(await token.pricePerShare()).to.equal(ethers.parseUnits("1", 18));
      expect(await bufferController.bufferNAV()).to.equal(0);

      // Accrue NAV to token
      await token.connect(navUpdater).accrue(ACCRUAL_AMOUNT);
      expect(await token.pricePerShare()).to.equal(ethers.parseUnits("1", 18) + ACCRUAL_AMOUNT);

      // Update buffer NAV (simulating buffer receiving its share)
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);
      expect(await bufferController.bufferNAV()).to.equal(BUFFER_TOP_UP);
    });

    it("should calculate utilization correctly with buffer NAV", async function () {
      // Set up buffer NAV
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);

      // Mint some tokens
      await token.connect(owner).mintTo(user1.address, MINT_AMOUNT);

      // Calculate total assets
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.pricePerShare();
      const totalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);

      // Check utilization
      const utilization = await bufferController.utilizationBps(totalAssets);
      expect(utilization).to.be.gt(0); // Should be > 0 since buffer < total assets
    });

    it("should request top-up when utilization is high", async function () {
      // Set up high utilization scenario
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);
      await token.connect(owner).mintTo(user1.address, MINT_AMOUNT * 5n); // Large mint

      // Calculate utilization
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.pricePerShare();
      const totalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      const utilization = await bufferController.utilizationBps(totalAssets);

      // Should request top-up if utilization is above threshold
      if (utilization >= await bufferController.utilizationThresholdBps()) {
        await expect(bufferController.connect(bufferManager).checkAndRequestTopUp(utilization))
          .to.emit(bufferAdapter, "TopUpRequested");
      }
    });
  });

  describe("Dual-Lane Redemption Stubs", function () {
    beforeEach(async function () {
      // Set up initial state
      await token.connect(owner).mintTo(user1.address, MINT_AMOUNT);
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);
    });

    it("should allow small redemption from buffer (stub)", async function () {
      const smallRedemption = ethers.parseUnits("100", 18);
      
      // Check if buffer can handle small redemption
      const canDrawdown = await bufferController.canDrawdown(smallRedemption);
      expect(canDrawdown).to.be.true;

      // Record drawdown from buffer (simulating small redemption)
      await bufferController.connect(bufferManager).recordDrawdown(smallRedemption);
      
      expect(await bufferController.bufferNAV()).to.equal(BUFFER_TOP_UP - smallRedemption);
    });

    it("should enqueue large redemption (stub)", async function () {
      const largeRedemption = ethers.parseUnits("1500", 18); // Larger than daily limit
      
      // Large redemption should exceed daily limit
      const dailyLimit = await bufferController.dailyDrawdownLimit();
      expect(largeRedemption).to.be.gt(dailyLimit);

      // Should not be able to drawdown large amount immediately
      const canDrawdown = await bufferController.canDrawdown(largeRedemption);
      expect(canDrawdown).to.be.false;

      // In a real implementation, this would enqueue the redemption
      // For now, we just verify the buffer can't handle it immediately
    });

    it("should respect daily drawdown limits for small redemptions", async function () {
      const dailyLimit = await bufferController.dailyDrawdownLimit();
      
      // Add more buffer NAV to ensure we can test daily limit
      await bufferController.connect(bufferManager).recordTopUp(dailyLimit);
      
      // Should be able to drawdown up to daily limit
      await bufferController.connect(bufferManager).recordDrawdown(dailyLimit);
      
      // Should not be able to drawdown more
      await expect(
        bufferController.connect(bufferManager).recordDrawdown(1n)
      ).to.be.revertedWithCustomError(bufferController, "DailyLimitExceeded");
    });

    it("should reset daily limits after 24 hours", async function () {
      const dailyLimit = await bufferController.dailyDrawdownLimit();
      
      // Add more buffer NAV to ensure we can test the reset
      await bufferController.connect(bufferManager).recordTopUp(dailyLimit * 2n);
      
      // Use up daily limit
      await bufferController.connect(bufferManager).recordDrawdown(dailyLimit);
      
      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      
      // Should be able to drawdown again
      await bufferController.connect(bufferManager).recordDrawdown(dailyLimit);
    });
  });

  describe("Buffer Integration with Tranche Controller", function () {
    it("should allow tranche controller to access buffer controller", async function () {
      // Verify tranche controller has buffer controller set
      expect(await trancheController.sovereignBufferController()).to.equal(await bufferController.getAddress());
    });

    it("should maintain buffer NAV integrity during operations", async function () {
      // Initial buffer NAV
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);
      expect(await bufferController.bufferNAV()).to.equal(BUFFER_TOP_UP);

      // Record some operations
      await bufferController.connect(bufferManager).recordTopUp(ethers.parseUnits("200", 18));
      await bufferController.connect(bufferManager).recordDrawdown(ethers.parseUnits("100", 18));

      // Buffer NAV should be: 500 + 200 - 100 = 600
      expect(await bufferController.bufferNAV()).to.equal(ethers.parseUnits("600", 18));
    });

    it("should prevent buffer from going negative", async function () {
      // Try to drawdown more than available
      await expect(
        bufferController.connect(bufferManager).recordDrawdown(BUFFER_TOP_UP + 1n)
      ).to.be.revertedWithCustomError(bufferController, "InsufficientBuffer");
    });
  });

  describe("Utilization Monitoring", function () {
    it("should track utilization changes over time", async function () {
      // Initial state - no buffer, 100% utilization
      await token.connect(owner).mintTo(user1.address, MINT_AMOUNT);
      const totalAssets1 = (await token.totalSupply() * await token.pricePerShare()) / ethers.parseUnits("1", 18);
      const utilization1 = await bufferController.utilizationBps(totalAssets1);
      expect(utilization1).to.equal(10000); // 100%

      // Add buffer - utilization should decrease
      await bufferController.connect(navUpdater).updateBufferNAV(BUFFER_TOP_UP);
      const utilization2 = await bufferController.utilizationBps(totalAssets1);
      expect(utilization2).to.be.lt(10000); // < 100%

      // Add more assets - utilization should increase
      await token.connect(owner).mintTo(user2.address, MINT_AMOUNT);
      const totalAssets3 = (await token.totalSupply() * await token.pricePerShare()) / ethers.parseUnits("1", 18);
      const utilization3 = await bufferController.utilizationBps(totalAssets3);
      expect(utilization3).to.be.gt(utilization2); // > previous utilization
    });

    it("should handle edge cases in utilization calculation", async function () {
      // Zero total assets
      const utilization1 = await bufferController.utilizationBps(0);
      expect(utilization1).to.equal(0);

      // Buffer larger than total assets
      await bufferController.connect(navUpdater).updateBufferNAV(ethers.parseUnits("10000", 18));
      await token.connect(owner).mintTo(user1.address, MINT_AMOUNT);
      const totalAssets = (await token.totalSupply() * await token.pricePerShare()) / ethers.parseUnits("1", 18);
      const utilization2 = await bufferController.utilizationBps(totalAssets);
      expect(utilization2).to.equal(0); // 0% utilization when buffer > assets
    });
  });
});
