import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSToken } from "../../typechain-types";

describe("BRICSToken Mint/Burn with Events", function () {
  let token: BRICSToken;
  let owner: any;
  let user: any;
  let registry: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Deploy MemberRegistry first
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    registry = await MemberRegistry.deploy(owner.address);
    
    // Set owner as registrar and user as member
    await registry.setRegistrar(owner.address);
    await registry.setMember(user.address, true);
    
    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    token = await BRICSToken.deploy(owner.address, await registry.getAddress());
  });

  describe("Mint with Events and TotalSupply", function () {
    it("should mint and emit Transfer event", async function () {
      const mintAmount = ethers.parseEther("100");
      const initialSupply = await token.totalSupply();
      
      await expect(token.mint(user.address, mintAmount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
      
      expect(await token.totalSupply()).to.equal(initialSupply + mintAmount);
      expect(await token.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("should track totalSupply correctly across multiple mints", async function () {
      const mint1 = ethers.parseEther("50");
      const mint2 = ethers.parseEther("75");
      
      const initialSupply = await token.totalSupply();
      
      await token.mint(user.address, mint1);
      expect(await token.totalSupply()).to.equal(initialSupply + mint1);
      
      await token.mint(user.address, mint2);
      expect(await token.totalSupply()).to.equal(initialSupply + mint1 + mint2);
    });

    it("should mint to multiple addresses", async function () {
      const [user1, user2] = await ethers.getSigners();
      await registry.setMember(user1.address, true);
      await registry.setMember(user2.address, true);
      
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      
      await token.mint(user1.address, amount1);
      await token.mint(user2.address, amount2);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount1);
      expect(await token.balanceOf(user2.address)).to.equal(amount2);
    });
  });

  describe("Burn with Events and TotalSupply", function () {
    beforeEach(async function () {
      // Mint some tokens first
      await token.mint(user.address, ethers.parseEther("1000"));
    });

    it("should burn and emit Transfer event", async function () {
      const burnAmount = ethers.parseEther("300");
      const initialSupply = await token.totalSupply();
      const initialBalance = await token.balanceOf(user.address);
      
      await expect(token.burn(user.address, burnAmount))
        .to.emit(token, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
      
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await token.balanceOf(user.address)).to.equal(initialBalance - burnAmount);
    });

    it("should track totalSupply correctly across multiple burns", async function () {
      const burn1 = ethers.parseEther("100");
      const burn2 = ethers.parseEther("200");
      
      const initialSupply = await token.totalSupply();
      
      await token.burn(user.address, burn1);
      expect(await token.totalSupply()).to.equal(initialSupply - burn1);
      
      await token.burn(user.address, burn2);
      expect(await token.totalSupply()).to.equal(initialSupply - burn1 - burn2);
    });

    it("should burn from multiple addresses", async function () {
      const [user1, user2] = await ethers.getSigners();
      await registry.setMember(user1.address, true);
      await registry.setMember(user2.address, true);
      
      await token.mint(user1.address, ethers.parseEther("500"));
      await token.mint(user2.address, ethers.parseEther("300"));
      
      const initialSupply = await token.totalSupply();
      
      await token.burn(user1.address, ethers.parseEther("200"));
      await token.burn(user2.address, ethers.parseEther("100"));
      
      expect(await token.totalSupply()).to.equal(initialSupply - ethers.parseEther("300"));
    });
  });

  describe("RBAC Enforcement", function () {
    it("should revert mint when caller lacks MINTER_ROLE", async function () {
      const mintAmount = ethers.parseEther("100");
      
      await expect(token.connect(user).mint(user.address, mintAmount))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(user.address, await token.MINTER_ROLE());
    });

    it("should revert burn when caller lacks BURNER_ROLE", async function () {
      await token.mint(user.address, ethers.parseEther("100"));
      
      await expect(token.connect(user).burn(user.address, ethers.parseEther("50")))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(user.address, await token.BURNER_ROLE());
    });

    it("should allow owner to grant MINTER_ROLE", async function () {
      await token.grantRole(await token.MINTER_ROLE(), user.address);
      
      const mintAmount = ethers.parseEther("100");
      await expect(token.connect(user).mint(user.address, mintAmount))
        .to.not.be.reverted;
    });

    it("should allow owner to revoke MINTER_ROLE", async function () {
      await token.grantRole(await token.MINTER_ROLE(), user.address);
      await token.revokeRole(await token.MINTER_ROLE(), user.address);
      
      const mintAmount = ethers.parseEther("100");
      await expect(token.connect(user).mint(user.address, mintAmount))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
});
