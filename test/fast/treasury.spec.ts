import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury } from "../../typechain-types";

describe("Treasury Fast Tests", function () {
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

  describe("Basic Functions", function () {
    it("should allow owner to set buffer target", async function () {
      await expect(treasury.setBufferTargetBps(6000))
        .to.not.be.reverted;
      
      expect(await treasury.bufferTargetBps()).to.equal(6000);
    });

    it("should allow funding", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      // Mint USDC to user
      await mockUSDC.mint(user.address, amount);
      
      // Approve treasury to spend user's USDC
      await mockUSDC.connect(user).approve(await treasury.getAddress(), amount);
      
      await expect(treasury.connect(user).fund(amount))
        .to.not.be.reverted;
      
      expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(amount);
    });

    it("should allow owner to pay", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      // Fund treasury first
      await mockUSDC.mint(owner.address, amount);
      await mockUSDC.approve(await treasury.getAddress(), amount);
      await treasury.fund(amount);
      
      await expect(treasury.pay(user.address, amount))
        .to.not.be.reverted;
      
      expect(await mockUSDC.balanceOf(user.address)).to.equal(amount);
    });

    it("should revert pay when not authorized", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(treasury.connect(user).pay(user.address, amount))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });
  });
});
