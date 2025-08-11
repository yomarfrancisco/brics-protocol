import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSToken } from "../../typechain-types";

describe("BRICSToken Fast Tests", function () {
  let token: BRICSToken;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Deploy MemberRegistry first
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    const registry = await MemberRegistry.deploy(owner.address);
    
    // Set owner as registrar (for simplicity in tests)
    await registry.setRegistrar(owner.address);
    
    // Set user as member
    await registry.setMember(user.address, true);
    
    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    token = await BRICSToken.deploy(owner.address, await registry.getAddress());
  });

  describe("Access Control", function () {
    it("should allow owner to mint", async function () {
      const mintAmount = ethers.parseEther("100");
      await expect(token.mint(user.address, mintAmount))
        .to.not.be.reverted;
      
      expect(await token.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("should allow owner to burn", async function () {
      const mintAmount = ethers.parseEther("100");
      await token.mint(user.address, mintAmount);
      
      const burnAmount = ethers.parseEther("50");
      await expect(token.burn(user.address, burnAmount))
        .to.not.be.reverted;
      
      expect(await token.balanceOf(user.address)).to.equal(mintAmount - burnAmount);
    });

    it("should revert mint when not owner", async function () {
      const mintAmount = ethers.parseEther("100");
      await expect(token.connect(user).mint(user.address, mintAmount))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert burn when not owner", async function () {
      const mintAmount = ethers.parseEther("100");
      await token.mint(user.address, mintAmount);
      
      const burnAmount = ethers.parseEther("50");
      await expect(token.connect(user).burn(user.address, burnAmount))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
});
