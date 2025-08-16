import { expect } from "chai";
import { ethers } from "hardhat";
import { TrancheControllerV1, BRICSTokenV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TrancheControllerV1", function () {
  let controller: TrancheControllerV1;
  let token: BRICSTokenV1;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let engine: SignerWithAddress;

  const CAP = ethers.parseUnits("10000", 18); // 10k shares
  const MINT_AMOUNT = ethers.parseUnits("1000", 18); // 1k shares
  const SHARE_PRICE_RAY = ethers.parseUnits("1", 27); // 1.0 in RAY

  beforeEach(async function () {
    [owner, user1, user2, engine] = await ethers.getSigners();

    // Deploy token first
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Deploy controller
    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    controller = await TrancheControllerV1Factory.deploy(await token.getAddress());

    // Set up roles
    await token.grantRole(await token.MINTER_ROLE(), controller.getAddress());
    await token.grantRole(await token.BURNER_ROLE(), controller.getAddress());
    await controller.grantRole(await controller.ENGINE_ROLE(), engine.address);

    // Set initial cap
    await controller.adjustSuperSeniorCap(CAP);
  });

  describe("Deployment", function () {
    it("should initialize with correct values", async function () {
      expect(await controller.token()).to.equal(await token.getAddress());
      expect(await controller.ssAttachBps()).to.equal(10000); // 100.00%
      expect(await controller.ssDetachBps()).to.equal(10200); // 102.00%
      expect(await controller.stressThresholdBps()).to.equal(8000); // 80.00%
      expect(await controller.stress()).to.be.false;
      expect(await controller.issuanceLocked()).to.be.false;
    });

    it("should grant admin and engine roles to deployer", async function () {
      expect(await controller.hasRole(await controller.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await controller.hasRole(await controller.ENGINE_ROLE(), owner.address)).to.be.true;
    });
  });

  describe("Cap Management", function () {
    it("should allow admin to adjust super senior cap", async function () {
      const newCap = ethers.parseUnits("20000", 18);
      await controller.adjustSuperSeniorCap(newCap);
      expect(await controller.superSeniorCap()).to.equal(newCap);
    });

    it("should emit CapAdjusted event", async function () {
      const newCap = ethers.parseUnits("15000", 18);
      await expect(controller.adjustSuperSeniorCap(newCap))
        .to.emit(controller, "CapAdjusted")
        .withArgs(newCap);
    });

    it("should revert if non-admin tries to adjust cap", async function () {
      await expect(
        controller.connect(user1).adjustSuperSeniorCap(ethers.parseUnits("20000", 18))
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });

    it("should revert if setting cap to zero", async function () {
      await expect(
        controller.adjustSuperSeniorCap(0)
      ).to.be.revertedWithCustomError(controller, "InvalidAmount");
    });
  });

  describe("Stress Management", function () {
    it("should allow admin to set stress flag", async function () {
      await controller.setStressFlag(true);
      expect(await controller.stress()).to.be.true;
    });

    it("should emit StressSet event", async function () {
      await expect(controller.setStressFlag(true))
        .to.emit(controller, "StressSet")
        .withArgs(true);
    });

    it("should revert if non-admin tries to set stress flag", async function () {
      await expect(
        controller.connect(user1).setStressFlag(true)
      ).to.be.revertedWithCustomError(controller, "AccessControlUnauthorizedAccount");
    });

    it("should allow admin to set caps and stress threshold", async function () {
      const newCap = ethers.parseUnits("15000", 18);
      const newStressThreshold = 7000; // 70%
      
      await controller.setCaps(newCap, newStressThreshold);
      expect(await controller.superSeniorCap()).to.equal(newCap);
      expect(await controller.stressThresholdBps()).to.equal(newStressThreshold);
    });

    it("should emit TrancheResized event when setting caps", async function () {
      const newCap = ethers.parseUnits("15000", 18);
      const newStressThreshold = 7000;
      
      await expect(controller.setCaps(newCap, newStressThreshold))
        .to.emit(controller, "TrancheResized")
        .withArgs(newCap, false); // stress is false initially
    });

    it("should revert if stress threshold > 100%", async function () {
      await expect(
        controller.setCaps(CAP, 10001)
      ).to.be.revertedWithCustomError(controller, "InvalidAmount");
    });
  });

  describe("maxMintable Function", function () {
    it("should return full capacity when not in stress", async function () {
      const maxMintable = await controller.maxMintable(0, SHARE_PRICE_RAY);
      expect(maxMintable).to.equal(CAP);
    });

    it("should return reduced capacity when in stress", async function () {
      await controller.setStressFlag(true);
      const maxMintable = await controller.maxMintable(0, SHARE_PRICE_RAY);
      // Should be 80% of CAP (stressThresholdBps = 8000)
      expect(maxMintable).to.equal((CAP * 8000n) / 10000n);
    });

    it("should return zero when issuance is locked", async function () {
      await controller.lockIssuance();
      const maxMintable = await controller.maxMintable(0, SHARE_PRICE_RAY);
      expect(maxMintable).to.equal(0);
    });

    it("should return zero when at cap", async function () {
      const maxMintable = await controller.maxMintable(CAP, SHARE_PRICE_RAY);
      expect(maxMintable).to.equal(0);
    });

    it("should return remaining capacity when partially filled", async function () {
      const currentSupply = ethers.parseUnits("3000", 18);
      const maxMintable = await controller.maxMintable(currentSupply, SHARE_PRICE_RAY);
      expect(maxMintable).to.equal(CAP - currentSupply);
    });

    it("should return reduced remaining capacity when in stress", async function () {
      await controller.setStressFlag(true);
      const currentSupply = ethers.parseUnits("3000", 18);
      const maxMintable = await controller.maxMintable(currentSupply, SHARE_PRICE_RAY);
      const expected = ((CAP - currentSupply) * 8000n) / 10000n;
      expect(maxMintable).to.equal(expected);
    });
  });

  describe("isStress Function", function () {
    it("should return false initially", async function () {
      expect(await controller.isStress()).to.be.false;
    });

    it("should return true when stress flag is set", async function () {
      await controller.setStressFlag(true);
      expect(await controller.isStress()).to.be.true;
    });

    it("should return false when stress flag is cleared", async function () {
      await controller.setStressFlag(true);
      await controller.setStressFlag(false);
      expect(await controller.isStress()).to.be.false;
    });
  });

  describe("Minting", function () {
    it("should allow admin to mint within cap", async function () {
      await controller.mint(user1.address, MINT_AMOUNT);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await token.totalSupply()).to.equal(MINT_AMOUNT);
    });

    it("should allow engine to mint within cap", async function () {
      await controller.connect(engine).mint(user1.address, MINT_AMOUNT);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it("should revert if minting beyond cap", async function () {
      const overCap = CAP + ethers.parseUnits("1", 18);
      await expect(
        controller.mint(user1.address, overCap)
      ).to.be.revertedWithCustomError(controller, "CapExceeded");
    });

    it("should revert if issuance is locked", async function () {
      await controller.lockIssuance();
      await expect(
        controller.mint(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "IssuanceLockedError");
    });

    it("should revert if non-admin/engine tries to mint", async function () {
      await expect(
        controller.connect(user1).mint(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "OnlyOwnerOrEngine");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await controller.mint(user1.address, MINT_AMOUNT);
    });

    it("should allow admin to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await controller.burn(user1.address, burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT - burnAmount);
    });

    it("should allow engine to burn tokens", async function () {
      const burnAmount = ethers.parseUnits("500", 18);
      await controller.connect(engine).burn(user1.address, burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(MINT_AMOUNT - burnAmount);
    });

    it("should revert if non-admin/engine tries to burn", async function () {
      await expect(
        controller.connect(user1).burn(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(controller, "OnlyOwnerOrEngine");
    });
  });

  describe("Record Functions", function () {
    it("should revert if non-token calls recordMint", async function () {
      await expect(
        controller.connect(user1).recordMint(MINT_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "OnlyOwnerOrEngine");
    });

    it("should revert if non-token calls recordRedemptionRequest", async function () {
      await expect(
        controller.connect(user1).recordRedemptionRequest(MINT_AMOUNT)
      ).to.be.revertedWithCustomError(controller, "OnlyOwnerOrEngine");
    });
  });

  describe("View Functions", function () {
    it("should return correct attachment point", async function () {
      expect(await controller.getAttachmentPoint()).to.equal(10000);
    });

    it("should return correct detachment target", async function () {
      expect(await controller.getDetachmentTarget()).to.equal(10200);
    });

    it("should return true when issuance is not locked", async function () {
      expect(await controller.canIssue()).to.be.true;
    });

    it("should return false when issuance is locked", async function () {
      await controller.lockIssuance();
      expect(await controller.canIssue()).to.be.false;
    });

    it("should return full capacity when no tokens minted", async function () {
      expect(await controller.getRemainingCapacity()).to.equal(CAP);
    });

    it("should return remaining capacity after minting", async function () {
      await controller.mint(user1.address, MINT_AMOUNT);
      expect(await controller.getRemainingCapacity()).to.equal(CAP - MINT_AMOUNT);
    });

    it("should return zero when at cap", async function () {
      await controller.mint(user1.address, CAP);
      expect(await controller.getRemainingCapacity()).to.equal(0);
    });

    it("should return zero when issuance locked", async function () {
      await controller.lockIssuance();
      expect(await controller.getRemainingCapacity()).to.equal(0);
    });
  });
});
