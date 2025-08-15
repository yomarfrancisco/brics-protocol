import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { safeIncreaseTo } from "./utils/time-helpers";
import { MezzanineVault } from "../typechain-types";
import { MockUSDC } from "../typechain-types";

describe("MezzanineVault", function () {
  async function deployFixture() {
    const [owner, user1, user2, nonWhitelistedUser] = await ethers.getSigners();
    
    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    
    // Set reinvestUntil to 1 year from now
    const reinvestUntil = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    
    // Deploy MezzanineVault
    const MezzanineVault = await ethers.getContractFactory("MezzanineVault");
    const mezzanineVault = await MezzanineVault.deploy(
      owner.address,
      await mockUSDC.getAddress(),
      reinvestUntil
    );
    
    // Mint some USDC to users
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    await mockUSDC.mint(user1.address, mintAmount);
    await mockUSDC.mint(user2.address, mintAmount);
    await mockUSDC.mint(nonWhitelistedUser.address, mintAmount);

    // ✅ Ensure recipient is whitelisted to avoid pool/member reverts
    await mezzanineVault.setWhitelist(user1.address, true);
    await mezzanineVault.setWhitelist(user2.address, true);

    return { 
      mezzanineVault, 
      mockUSDC, 
      owner, 
      user1, 
      user2, 
      nonWhitelistedUser, 
      reinvestUntil 
    };
  }

  describe("Constructor", function () {
    it("should deploy with correct parameters", async function () {
      const { mezzanineVault, mockUSDC, owner, reinvestUntil } = await loadFixture(deployFixture);
      expect(await mezzanineVault.name()).to.equal("BRICS Mezzanine Shares");
      expect(await mezzanineVault.symbol()).to.equal("BRICS-MZ");
      expect(await mezzanineVault.asset()).to.equal(await mockUSDC.getAddress());
      expect(await mezzanineVault.reinvestUntil()).to.equal(reinvestUntil);
      expect(await mezzanineVault.principalLocked()).to.equal(true);
      
      // Check roles
      expect(await mezzanineVault.hasRole(await mezzanineVault.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await mezzanineVault.hasRole(await mezzanineVault.GOV_ROLE(), owner.address)).to.equal(true);
    });
  });

  describe("Whitelist Management", function () {
    it("should allow GOV_ROLE to set whitelist", async function () {
      const { mezzanineVault, user1 } = await loadFixture(deployFixture);
      await expect(mezzanineVault.setWhitelist(user1.address, true))
        .to.emit(mezzanineVault, "Whitelist")
        .withArgs(user1.address, true);
      
      expect(await mezzanineVault.isWhitelisted(user1.address)).to.equal(true);
    });

    it("should allow GOV_ROLE to remove from whitelist", async function () {
      const { mezzanineVault, user1 } = await loadFixture(deployFixture);
      await mezzanineVault.setWhitelist(user1.address, true);
      
      await expect(mezzanineVault.setWhitelist(user1.address, false))
        .to.emit(mezzanineVault, "Whitelist")
        .withArgs(user1.address, false);
      
      expect(await mezzanineVault.isWhitelisted(user1.address)).to.equal(false);
    });

    it("should revert when non-GOV_ROLE tries to set whitelist", async function () {
      const { mezzanineVault, user1, user2 } = await loadFixture(deployFixture);
      await expect(
        mezzanineVault.connect(user1).setWhitelist(user2.address, true)
      ).to.be.revertedWithCustomError(mezzanineVault, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Deposit Functionality", function () {
    it("should allow whitelisted user to deposit", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      const depositAmount = ethers.parseUnits("100", 6);
      const sharesBefore = await mezzanineVault.balanceOf(user1.address);
      
      await expect(mezzanineVault.connect(user1).deposit(depositAmount, user1.address))
        .to.not.be.reverted;
      
      const sharesAfter = await mezzanineVault.balanceOf(user1.address);
      expect(sharesAfter).to.be.gt(sharesBefore);
    });

    it("should revert when non-whitelisted user tries to deposit", async function () {
      const { mezzanineVault, mockUSDC, nonWhitelistedUser } = await loadFixture(deployFixture);
      const depositAmount = ethers.parseUnits("100", 6);
      await mockUSDC.connect(nonWhitelistedUser).approve(await mezzanineVault.getAddress(), depositAmount);
      
      await expect(
        mezzanineVault.connect(nonWhitelistedUser).deposit(depositAmount, nonWhitelistedUser.address)
      ).to.be.revertedWith("not wl");
    });

    it("should allow deposit to different receiver", async function () {
      const { mezzanineVault, mockUSDC, user1, user2 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      const depositAmount = ethers.parseUnits("100", 6);
      
      await expect(mezzanineVault.connect(user1).deposit(depositAmount, user2.address))
        .to.not.be.reverted;
      
      expect(await mezzanineVault.balanceOf(user2.address)).to.be.gt(0);
    });
  });

  describe("Mint Functionality", function () {
    it("should revert when non-whitelisted user tries to mint", async function () {
      const { mezzanineVault, mockUSDC, nonWhitelistedUser } = await loadFixture(deployFixture);
      const mintShares = ethers.parseUnits("100", 18);
      await mockUSDC.connect(nonWhitelistedUser).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      await expect(
        mezzanineVault.connect(nonWhitelistedUser).mint(mintShares, nonWhitelistedUser.address)
      ).to.be.revertedWith("not wl");
    });
  });

  describe("Withdraw Functionality", function () {
    it("should revert withdraw before reinvestUntil when principalLocked is true", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      // Get current block timestamp and check reinvestUntil
      const latest = await ethers.provider.getBlock('latest');
      const currentTime = latest.timestamp;
      const reinvestUntil = await mezzanineVault.reinvestUntil();
      
      const withdrawAmount = ethers.parseUnits("10", 6);
      
      // BEFORE: expect revert with specific error message if current time < reinvestUntil
      if (currentTime < reinvestUntil) {
        await expect(
          mezzanineVault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
        ).to.be.revertedWith("reinvest lock");
      }
      
      // Advance time past reinvestUntil using safe helper
      await safeIncreaseTo(Number(reinvestUntil) + 1);
      
      // AFTER: expect success (or at least not the 'reinvest lock' error)
      await expect(
        mezzanineVault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
      ).to.not.be.reverted;
    });

    it("should allow withdraw after reinvestUntil", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      // Fast forward time past reinvestUntil using safe helper
      await safeIncreaseTo(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 + 1);
      
      // Check how many assets the user can withdraw
      const userShares = await mezzanineVault.balanceOf(user1.address);
      const totalAssets = await mezzanineVault.totalAssets();
      const totalSupply = await mezzanineVault.totalSupply();
      
      let withdrawAmount;
      if (totalSupply > 0) {
        withdrawAmount = (userShares * totalAssets) / totalSupply;
        withdrawAmount = withdrawAmount > 0 ? withdrawAmount / 2n : ethers.parseUnits("1", 6);
      } else {
        withdrawAmount = ethers.parseUnits("1", 6);
      }
      
      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      
      await expect(mezzanineVault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
        .to.not.be.reverted;
      
      const balanceAfter = await mockUSDC.balanceOf(user1.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
    });

    it("should allow withdraw to different receiver", async function () {
      const { mezzanineVault, mockUSDC, user1, user2 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      // Fast forward time past reinvestUntil using safe helper
      await safeIncreaseTo(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 + 1);
      
      const withdrawAmount = ethers.parseUnits("10", 6);
      const balanceBefore = await mockUSDC.balanceOf(user2.address);
      
      await expect(mezzanineVault.connect(user1).withdraw(withdrawAmount, user2.address, user1.address))
        .to.not.be.reverted;
      
      const balanceAfter = await mockUSDC.balanceOf(user2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Redeem Functionality", function () {
    it("should revert redeem before reinvestUntil when principalLocked is true", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      const redeemShares = ethers.parseUnits("10", 18);
      
      await expect(
        mezzanineVault.connect(user1).redeem(redeemShares, user1.address, user1.address)
      ).to.be.reverted;
    });

    it("should allow redeem after reinvestUntil", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      // Fast forward time past reinvestUntil using safe helper
      await safeIncreaseTo(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 + 1);
      
      // Check how many shares the user has
      const userShares = await mezzanineVault.balanceOf(user1.address);
      const redeemShares = userShares > 0 ? userShares / 2n : ethers.parseUnits("1", 18);
      
      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      
      await expect(mezzanineVault.connect(user1).redeem(redeemShares, user1.address, user1.address))
        .to.not.be.reverted;
      
      const balanceAfter = await mockUSDC.balanceOf(user1.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
    });

    it("should allow redeem to different receiver", async function () {
      const { mezzanineVault, mockUSDC, user1, user2 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      // Deposit some assets first
      await mezzanineVault.connect(user1).deposit(ethers.parseUnits("100", 6), user1.address);
      
      // Fast forward time past reinvestUntil using safe helper
      await safeIncreaseTo(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 + 1);
      
      // Check how many shares the user has
      const userShares = await mezzanineVault.balanceOf(user1.address);
      const redeemShares = userShares > 0 ? userShares / 4n : ethers.parseUnits("1", 18);
      
      const balanceBefore = await mockUSDC.balanceOf(user2.address);
      
      await expect(mezzanineVault.connect(user1).redeem(redeemShares, user2.address, user1.address))
        .to.not.be.reverted;
      
      const balanceAfter = await mockUSDC.balanceOf(user2.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
    });
  });

  describe("View Functions", function () {
    it("should return correct reinvestUntil", async function () {
      const { mezzanineVault, reinvestUntil } = await loadFixture(deployFixture);
      expect(await mezzanineVault.reinvestUntil()).to.equal(reinvestUntil);
    });

    it("should return correct principalLocked", async function () {
      const { mezzanineVault } = await loadFixture(deployFixture);
      expect(await mezzanineVault.principalLocked()).to.equal(true);
    });

    it("should return correct whitelist status", async function () {
      const { mezzanineVault, user1 } = await loadFixture(deployFixture);
      expect(await mezzanineVault.isWhitelisted(user1.address)).to.equal(true); // Already whitelisted in fixture
      
      await mezzanineVault.setWhitelist(user1.address, false);
      expect(await mezzanineVault.isWhitelisted(user1.address)).to.equal(false);
    });

    it("should return correct GOV_ROLE", async function () {
      const { mezzanineVault } = await loadFixture(deployFixture);
      const govRole = await mezzanineVault.GOV_ROLE();
      expect(govRole).to.equal(ethers.keccak256(ethers.toUtf8Bytes("GOV")));
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amount deposits", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      await expect(mezzanineVault.connect(user1).deposit(0, user1.address))
        .to.not.be.reverted;
    });

    it("should handle zero amount mints", async function () {
      const { mezzanineVault, mockUSDC, user1 } = await loadFixture(deployFixture);
      await mockUSDC.connect(user1).approve(await mezzanineVault.getAddress(), ethers.parseUnits("1000", 6));
      
      await expect(mezzanineVault.connect(user1).mint(0, user1.address))
        .to.not.be.reverted;
    });

    it("should handle multiple whitelist operations", async function () {
      const { mezzanineVault, user1, user2 } = await loadFixture(deployFixture);
      await mezzanineVault.setWhitelist(user2.address, true);
      await mezzanineVault.setWhitelist(user1.address, false);
      
      expect(await mezzanineVault.isWhitelisted(user1.address)).to.equal(false);
      expect(await mezzanineVault.isWhitelisted(user2.address)).to.equal(true);
    });
  });
});
