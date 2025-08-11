import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury } from "../../typechain-types";

describe("Treasury Pay/Fund with Liquidity Status", function () {
  let treasury: Treasury;
  let owner: any;
  let user: any;
  let mockUSDC: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address, await mockUSDC.getAddress(), 5000); // 50% target
  });

  describe("Fund Operations", function () {
    it("should allow funding and update balances", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      // Mint USDC to user
      await mockUSDC.mint(user.address, amount);
      
      // Approve treasury to spend user's USDC
      await mockUSDC.connect(user).approve(await treasury.getAddress(), amount);
      
      const initialTreasuryBalance = await mockUSDC.balanceOf(await treasury.getAddress());
      
      await expect(treasury.connect(user).fund(amount))
        .to.not.be.reverted;
      
      expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(initialTreasuryBalance + amount);
    });

    it("should allow multiple funding operations", async function () {
      const amount1 = ethers.parseUnits("500", 6);
      const amount2 = ethers.parseUnits("300", 6);
      
      // Fund first amount
      await mockUSDC.mint(user.address, amount1 + amount2);
      await mockUSDC.connect(user).approve(await treasury.getAddress(), amount1 + amount2);
      
      await treasury.connect(user).fund(amount1);
      expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(amount1);
      
      await treasury.connect(user).fund(amount2);
      expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(amount1 + amount2);
    });

    it("should revert funding when insufficient allowance", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await mockUSDC.mint(user.address, amount);
      await mockUSDC.connect(user).approve(await treasury.getAddress(), amount - ethers.parseUnits("100", 6));
      
      await expect(treasury.connect(user).fund(amount))
        .to.be.reverted;
    });
  });

  describe("Pay Operations", function () {
    beforeEach(async function () {
      // Fund treasury first
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(owner.address, amount);
      await mockUSDC.approve(await treasury.getAddress(), amount);
      await treasury.fund(amount);
    });

    it("should allow owner to pay and update balances", async function () {
      const payAmount = ethers.parseUnits("500", 6);
      const initialUserBalance = await mockUSDC.balanceOf(user.address);
      const initialTreasuryBalance = await mockUSDC.balanceOf(await treasury.getAddress());
      
      await expect(treasury.pay(user.address, payAmount))
        .to.not.be.reverted;
      
      expect(await mockUSDC.balanceOf(user.address)).to.equal(initialUserBalance + payAmount);
      expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(initialTreasuryBalance - payAmount);
    });

    it("should revert pay when not authorized", async function () {
      const payAmount = ethers.parseUnits("100", 6);
      
      await expect(treasury.connect(user).pay(user.address, payAmount))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });

    it("should revert pay when insufficient treasury balance", async function () {
      const payAmount = ethers.parseUnits("2000", 6); // More than treasury has
      
      await expect(treasury.pay(user.address, payAmount))
        .to.be.reverted;
    });
  });

  describe("getLiquidityStatus Function", function () {
    it("should return correct structure and values", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(owner.address, amount);
      await mockUSDC.approve(await treasury.getAddress(), amount);
      await treasury.fund(amount);
      
      const status = await treasury.getLiquidityStatus();
      
      // Returns: (preTranche, irbBalance, irbTarget, shortfallBps, healthy)
      expect(status[0]).to.equal(0); // preTranche (always 0 for now)
      expect(status[1]).to.equal(amount); // irbBalance (current balance)
      expect(status[2]).to.equal(5000); // irbTarget (50% = 5000 bps)
      expect(status[3]).to.equal(0); // shortfallBps (0 when balance >= target)
      expect(status[4]).to.equal(true); // healthy (true when balance >= target)
    });

    it("should handle zero balance correctly", async function () {
      const status = await treasury.getLiquidityStatus();
      
      // Returns: (preTranche, irbBalance, irbTarget, shortfallBps, healthy)
      expect(status[0]).to.equal(0); // preTranche
      expect(status[1]).to.equal(0); // irbBalance (current)
      expect(status[2]).to.equal(5000); // irbTarget (50% = 5000 bps)
      expect(status[3]).to.equal(10000); // shortfallBps (100% shortfall when zero balance)
      expect(status[4]).to.equal(false); // healthy (should be false when zero balance)
    });

    it("should test balance function", async function () {
      const balance = await treasury.balance();
      expect(balance).to.equal(0);
      
      // Fund some amount and check balance
      const amount = ethers.parseUnits("100", 6);
      await mockUSDC.mint(owner.address, amount);
      await mockUSDC.approve(await treasury.getAddress(), amount);
      await treasury.fund(amount);
      
      const newBalance = await treasury.balance();
      expect(newBalance).to.equal(amount);
    });

    it("should calculate shortfall when balance is below target", async function () {
      // Test with zero balance (should definitely be below target)
      const status = await treasury.getLiquidityStatus();
      
      // Returns: (preTranche, irbBalance, irbTarget, shortfallBps, healthy)
      expect(status[0]).to.equal(0); // preTranche
      expect(status[1]).to.equal(0); // irbBalance (current)
      expect(status[2]).to.equal(5000); // irbTarget (5000 USDC)
      expect(status[3]).to.be.gt(0); // shortfallBps (should be > 0 when below target)
      expect(status[4]).to.equal(false); // healthy (should be false when below target)
    });
  });

  describe("Buffer Target Configuration", function () {
    it("should allow owner to set buffer target", async function () {
      const newTarget = 6000; // 60%
      
      await expect(treasury.setBufferTargetBps(newTarget))
        .to.not.be.reverted;
      
      expect(await treasury.bufferTargetBps()).to.equal(newTarget);
    });

    it("should revert setBufferTargetBps when not authorized", async function () {
      const newTarget = 6000;
      
      await expect(treasury.connect(user).setBufferTargetBps(newTarget))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });

    it("should update liquidity status after target change", async function () {
      const initialTarget = await treasury.bufferTargetBps();
      const newTarget = 7000; // 70%
      
      await treasury.setBufferTargetBps(newTarget);
      
      const status = await treasury.getLiquidityStatus();
      expect(status[2]).to.equal(7000); // 70% = 7000 bps
    });
  });
});
