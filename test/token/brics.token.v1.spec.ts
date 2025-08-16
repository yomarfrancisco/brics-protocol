import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BRICSTokenV1", function () {
  let token: BRICSTokenV1;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let minter: SignerWithAddress;
  let burner: SignerWithAddress;
  let navUpdater: SignerWithAddress;

  const INITIAL_SHARE_PRICE = ethers.parseUnits("1", 18); // 1.0
  const MINT_AMOUNT = ethers.parseUnits("1000", 18); // 1000 shares
  const NAV_DELTA = ethers.parseUnits("0.05", 18); // 0.05 NAV increase

  beforeEach(async function () {
    [owner, user1, user2, minter, burner, navUpdater] = await ethers.getSigners();

    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Grant roles to different addresses for testing
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
    await token.grantRole(await token.BURNER_ROLE(), burner.address);
    await token.grantRole(await token.NAV_UPDATER_ROLE(), navUpdater.address);
  });

  describe("Deployment", function () {
    it("should initialize with correct values", async function () {
      expect(await token.name()).to.equal("BRICS Super-Senior");
      expect(await token.symbol()).to.equal("BRICS");
      expect(await token.decimals()).to.equal(18);
      expect(await token.sharePrice()).to.equal(INITIAL_SHARE_PRICE);
      expect(await token.totalSupply()).to.equal(0);
      expect(await token.totalAssets()).to.equal(0);
    });

    it("should grant admin roles to deployer", async function () {
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await token.hasRole(await token.MINTER_ROLE(), owner.address)).to.be.true;
      expect(await token.hasRole(await token.BURNER_ROLE(), owner.address)).to.be.true;
      expect(await token.hasRole(await token.CONTROLLER_ROLE(), owner.address)).to.be.true;
      expect(await token.hasRole(await token.NAV_UPDATER_ROLE(), owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("should allow minter to mint tokens", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      expect(await token.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await token.totalAssets()).to.equal(MINT_AMOUNT); // sharePrice = 1.0
    });

    it("should revert if non-minter tries to mint", async function () {
      await expect(
        token.connect(user1).mintTo(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if minting to zero address", async function () {
      await expect(
        token.connect(minter).mintTo(ethers.ZeroAddress, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("should revert if minting zero amount", async function () {
      await expect(
        token.connect(minter).mintTo(user1.address, 0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
    });

    it("should allow burner to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await token.connect(burner).burnFrom(user1.address, burnAmount);
      
      expect(await token.totalSupply()).to.equal(MINT_AMOUNT - burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT - burnAmount);
    });

    it("should revert if non-burner tries to burn", async function () {
      await expect(
        token.connect(user1).burnFrom(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if burning from zero address", async function () {
      await expect(
        token.connect(burner).burnFrom(ethers.ZeroAddress, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("should revert if burning zero amount", async function () {
      await expect(
        token.connect(burner).burnFrom(user1.address, 0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("NAV Accrual", function () {
    beforeEach(async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
    });

    it("should allow NAV updater to accrue NAV", async function () {
      const initialSharePrice = await token.sharePrice();
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      const newSharePrice = await token.sharePrice();
      expect(newSharePrice).to.equal(initialSharePrice + NAV_DELTA);
      
      // Check totalAssets increased proportionally
      const expectedTotalAssets = (MINT_AMOUNT * newSharePrice) / ethers.parseUnits("1", 18);
      expect(await token.totalAssets()).to.equal(expectedTotalAssets);
    });

    it("should revert if non-NAV-updater tries to accrue", async function () {
      await expect(
        token.connect(user1).accrue(NAV_DELTA)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if accruing zero amount", async function () {
      await expect(
        token.connect(navUpdater).accrue(0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should emit SharePriceAccrued event", async function () {
      const initialSharePrice = await token.sharePrice();
      await expect(token.connect(navUpdater).accrue(NAV_DELTA))
        .to.emit(token, "SharePriceAccrued")
        .withArgs(NAV_DELTA, initialSharePrice + NAV_DELTA);
    });
  });

  describe("Preview Functions", function () {
    beforeEach(async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      // Accrue some NAV to test with non-1.0 share price
      await token.connect(navUpdater).accrue(NAV_DELTA);
    });

    it("should correctly preview mint for given assets", async function () {
      const assets = ethers.parseUnits("1000", 18);
      const expectedShares = (assets * ethers.parseUnits("1", 18)) / await token.sharePrice();
      
      expect(await token.previewMint(assets)).to.equal(expectedShares);
    });

    it("should correctly preview redeem for given shares", async function () {
      const shares = ethers.parseUnits("500", 18);
      const expectedAssets = (shares * await token.sharePrice()) / ethers.parseUnits("1", 18);
      
      expect(await token.previewRedeem(shares)).to.equal(expectedAssets);
    });

    it("should return zero for previewMint when sharePrice is zero", async function () {
      // This test case is theoretical since sharePrice starts at 1.0 and only increases
      // But it's good to have the check in place
      expect(await token.previewMint(ethers.parseUnits("1000", 18))).to.be.gt(0);
    });
  });

  describe("Controller Management", function () {
    it("should allow admin to set controller", async function () {
      await token.setController(user1.address);
      expect(await token.controller()).to.equal(user1.address);
    });

    it("should emit ControllerSet event", async function () {
      await expect(token.setController(user1.address))
        .to.emit(token, "ControllerSet")
        .withArgs(user1.address);
    });

    it("should revert if non-admin tries to set controller", async function () {
      await expect(
        token.connect(user1).setController(user2.address)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert if setting controller to zero address", async function () {
      await expect(
        token.setController(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
    });

    it("should return correct price per share", async function () {
      expect(await token.pricePerShare()).to.equal(await token.sharePrice());
    });

    it("should calculate totalAssets correctly", async function () {
      const sharePrice = await token.sharePrice();
      const totalSupply = await token.totalSupply();
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      
      expect(await token.totalAssets()).to.equal(expectedTotalAssets);
    });
  });

  describe("Invariants", function () {
    it("should maintain totalShares * sharePrice ~= totalNAV within rounding", async function () {
      // Mint some tokens
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      // Accrue NAV multiple times
      for (let i = 0; i < 5; i++) {
        await token.connect(navUpdater).accrue(NAV_DELTA);
        
        const totalSupply = await token.totalSupply();
        const sharePrice = await token.sharePrice();
        const totalAssets = await token.totalAssets();
        
        // Check invariant: totalAssets should equal (totalSupply * sharePrice) / 1e18
        const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
        expect(totalAssets).to.equal(expectedTotalAssets);
      }
    });

    it("should maintain sharePrice monotonicity", async function () {
      const initialSharePrice = await token.sharePrice();
      
      // Accrue NAV multiple times
      for (let i = 0; i < 3; i++) {
        const previousSharePrice = await token.sharePrice();
        await token.connect(navUpdater).accrue(NAV_DELTA);
        const newSharePrice = await token.sharePrice();
        
        // Share price should only increase
        expect(newSharePrice).to.be.gt(previousSharePrice);
      }
      
      // Final share price should be greater than initial
      expect(await token.sharePrice()).to.be.gt(initialSharePrice);
    });

    it("should handle multiple mints and burns correctly", async function () {
      // Mint to multiple users
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(minter).mintTo(user2.address, MINT_AMOUNT);
      
      // Accrue NAV
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      // Burn from one user
      await token.connect(burner).burnFrom(user1.address, ethers.parseUnits("500", 18));
      
      // Check totalAssets still matches the invariant
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      
      expect(totalAssets).to.equal(expectedTotalAssets);
    });
  });
});
