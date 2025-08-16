import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BRICSTokenV1 Invariants", function () {
  let token: BRICSTokenV1;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let minter: SignerWithAddress;
  let burner: SignerWithAddress;
  let navUpdater: SignerWithAddress;

  const MINT_AMOUNT = ethers.parseUnits("1000", 18);
  const NAV_DELTA = ethers.parseUnits("0.05", 18);

  beforeEach(async function () {
    [owner, user1, user2, minter, burner, navUpdater] = await ethers.getSigners();

    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Grant roles
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
    await token.grantRole(await token.BURNER_ROLE(), burner.address);
    await token.grantRole(await token.NAV_UPDATER_ROLE(), navUpdater.address);
  });

  describe("NAV/Share Math Invariants", function () {
    it("should maintain totalShares * sharePrice = totalNAV invariant after mint", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      // Check invariant: totalAssets = (totalSupply * sharePrice) / 1e18
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should maintain invariant after NAV accrual", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should maintain invariant after burn", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(navUpdater).accrue(NAV_DELTA);
      await token.connect(burner).burnFrom(user1.address, ethers.parseUnits("500", 18));
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should maintain invariant through complex operations", async function () {
      // Mint to multiple users
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(minter).mintTo(user2.address, MINT_AMOUNT);
      
      // Accrue NAV
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      // Burn from one user
      await token.connect(burner).burnFrom(user1.address, ethers.parseUnits("300", 18));
      
      // Accrue more NAV
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      // Mint more
      await token.connect(minter).mintTo(user1.address, ethers.parseUnits("200", 18));
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should handle edge case with very small amounts", async function () {
      const smallAmount = ethers.parseUnits("0.001", 18);
      await token.connect(minter).mintTo(user1.address, smallAmount);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should handle edge case with very large amounts", async function () {
      const largeAmount = ethers.parseUnits("1000000", 18); // 1M shares
      await token.connect(minter).mintTo(user1.address, largeAmount);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });
  });

  describe("Share Price Monotonicity", function () {
    it("should only increase share price through accrual", async function () {
      const initialSharePrice = await token.sharePrice();
      
      // Multiple accruals
      for (let i = 0; i < 5; i++) {
        const previousSharePrice = await token.sharePrice();
        await token.connect(navUpdater).accrue(NAV_DELTA);
        const newSharePrice = await token.sharePrice();
        
        expect(newSharePrice).to.be.gt(previousSharePrice);
      }
      
      expect(await token.sharePrice()).to.be.gt(initialSharePrice);
    });

    it("should maintain share price through mints and burns", async function () {
      const initialSharePrice = await token.sharePrice();
      
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      expect(await token.sharePrice()).to.equal(initialSharePrice);
      
      await token.connect(burner).burnFrom(user1.address, ethers.parseUnits("500", 18));
      expect(await token.sharePrice()).to.equal(initialSharePrice);
    });
  });

  describe("Precision and Rounding", function () {
    it("should handle rounding correctly in preview functions", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      const shares = ethers.parseUnits("1", 18);
      const previewAssets = await token.previewRedeem(shares);
      const actualAssets = await token.totalAssets();
      
      // Preview should be consistent with total assets calculation
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const expectedAssets = (shares * sharePrice) / ethers.parseUnits("1", 18);
      
      expect(previewAssets).to.equal(expectedAssets);
    });

    it("should maintain precision through multiple operations", async function () {
      // Mint with precise amount
      const preciseAmount = ethers.parseUnits("1234.56789", 18);
      await token.connect(minter).mintTo(user1.address, preciseAmount);
      
      // Accrue with precise NAV
      const preciseNAV = ethers.parseUnits("0.12345", 18);
      await token.connect(navUpdater).accrue(preciseNAV);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });
  });

  describe("State Consistency", function () {
    it("should maintain consistent state after role changes", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      // Revoke and regrant roles
      await token.revokeRole(await token.MINTER_ROLE(), minter.address);
      await token.grantRole(await token.MINTER_ROLE(), minter.address);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });

    it("should maintain consistent state after controller changes", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(navUpdater).accrue(NAV_DELTA);
      
      // Change controller
      await token.setController(user2.address);
      
      const totalSupply = await token.totalSupply();
      const sharePrice = await token.sharePrice();
      const totalAssets = await token.totalAssets();
      
      const expectedTotalAssets = (totalSupply * sharePrice) / ethers.parseUnits("1", 18);
      expect(totalAssets).to.equal(expectedTotalAssets);
    });
  });
});
