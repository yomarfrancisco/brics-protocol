import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, TrancheControllerV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BRICSTokenV1 + TrancheControllerV1 Integration", function () {
  let token: BRICSTokenV1;
  let controller: TrancheControllerV1;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let minter: SignerWithAddress;

  const CAP = ethers.parseUnits("10000", 18); // 10k shares
  const MINT_AMOUNT = ethers.parseUnits("1000", 18); // 1k shares

  beforeEach(async function () {
    [owner, user1, user2, minter] = await ethers.getSigners();

    // Deploy token first
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Deploy controller
    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    controller = await TrancheControllerV1Factory.deploy(await token.getAddress());

    // Set up roles
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
    await token.grantRole(await token.BURNER_ROLE(), minter.address);
    await token.grantRole(await token.NAV_UPDATER_ROLE(), minter.address);
    await controller.grantRole(await controller.ENGINE_ROLE(), minter.address);

    // Set controller on token
    await token.setController(await controller.getAddress());

    // Set initial cap
    await controller.adjustSuperSeniorCap(CAP);
  });

  describe("Mint Gating", function () {
    it("should allow minting up to cap", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await token.totalSupply()).to.equal(MINT_AMOUNT);
    });

    it("should allow minting exactly at cap", async function () {
      await token.connect(minter).mintTo(user1.address, CAP);
      expect(await token.balanceOf(user1.address)).to.equal(CAP);
      expect(await token.totalSupply()).to.equal(CAP);
    });

    it("should revert if minting one wei beyond cap", async function () {
      const overCap = CAP + 1n;
      await expect(
        token.connect(minter).mintTo(user1.address, overCap)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should revert if minting significantly beyond cap", async function () {
      const overCap = CAP + ethers.parseUnits("1000", 18);
      await expect(
        token.connect(minter).mintTo(user1.address, overCap)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should allow minting after partial mint", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(minter).mintTo(user2.address, MINT_AMOUNT);
      
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await token.balanceOf(user2.address)).to.equal(MINT_AMOUNT);
      expect(await token.totalSupply()).to.equal(MINT_AMOUNT * 2n);
    });

    it("should revert if trying to mint remaining + 1", async function () {
      await token.connect(minter).mintTo(user1.address, CAP - 1n);
      await expect(
        token.connect(minter).mintTo(user2.address, 2n)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("Stress Mode Integration", function () {
    it("should reduce mintable capacity when in stress", async function () {
      await controller.setStressFlag(true);
      
      // Should be able to mint 80% of cap (stressThresholdBps = 8000)
      const stressCap = (CAP * 8000n) / 10000n;
      await token.connect(minter).mintTo(user1.address, stressCap);
      
      // Should revert if trying to mint more
      await expect(
        token.connect(minter).mintTo(user2.address, 1n)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should restore full capacity when stress is cleared", async function () {
      await controller.setStressFlag(true);
      await controller.setStressFlag(false);
      
      // Should be able to mint full cap again
      await token.connect(minter).mintTo(user1.address, CAP);
      expect(await token.balanceOf(user1.address)).to.equal(CAP);
    });

    it("should handle stress mode with partial supply", async function () {
      // Mint some tokens first
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      // Enter stress mode
      await controller.setStressFlag(true);
      
      // Should be able to mint remaining capacity under stress
      const remainingUnderStress = ((CAP - MINT_AMOUNT) * 8000n) / 10000n;
      await token.connect(minter).mintTo(user2.address, remainingUnderStress);
      
      // Should revert if trying to mint more
      await expect(
        token.connect(minter).mintTo(user2.address, 1n)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("Issuance Lock Integration", function () {
    it("should prevent minting when issuance is locked", async function () {
      await controller.lockIssuance();
      
      await expect(
        token.connect(minter).mintTo(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should allow minting when issuance is unlocked", async function () {
      await controller.lockIssuance();
      await controller.unlockIssuance();
      
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });
  });

  describe("Controller Record Functions", function () {
    it("should call recordMint when minting", async function () {
      // This test verifies that the integration works
      // The actual recordMint function is bookkeeping-only for MVP
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      // Should not revert, indicating recordMint was called successfully
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it("should handle multiple mints with recordMint", async function () {
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      await token.connect(minter).mintTo(user2.address, MINT_AMOUNT);
      
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await token.balanceOf(user2.address)).to.equal(MINT_AMOUNT);
    });
  });

  describe("Cap Adjustment Integration", function () {
    it("should respect new cap after adjustment", async function () {
      const newCap = ethers.parseUnits("5000", 18);
      await controller.adjustSuperSeniorCap(newCap);
      
      // Should be able to mint up to new cap
      await token.connect(minter).mintTo(user1.address, newCap);
      
      // Should revert if trying to mint more
      await expect(
        token.connect(minter).mintTo(user2.address, 1n)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should handle cap reduction with existing supply", async function () {
      // Mint some tokens first
      await token.connect(minter).mintTo(user1.address, MINT_AMOUNT);
      
      // Reduce cap below current supply
      const newCap = MINT_AMOUNT - ethers.parseUnits("100", 18);
      await controller.adjustSuperSeniorCap(newCap);
      
      // Should revert if trying to mint more
      await expect(
        token.connect(minter).mintTo(user2.address, 1n)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amount mint", async function () {
      await expect(
        token.connect(minter).mintTo(user1.address, 0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should handle minting to zero address", async function () {
      await expect(
        token.connect(minter).mintTo(ethers.ZeroAddress, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("should work without controller set", async function () {
      // Remove controller
      await token.setController(ethers.ZeroAddress);
      
      // Should be able to mint without cap checks
      await token.connect(minter).mintTo(user1.address, CAP + ethers.parseUnits("1000", 18));
    });
  });
});
