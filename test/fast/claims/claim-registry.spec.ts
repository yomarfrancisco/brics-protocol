import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ClaimRegistry } from "../../../typechain-types";

describe("ClaimRegistry Fast Tests", function () {
  let claimRegistry: ClaimRegistry;
  let gov: any;
  let user: any;
  let user2: any;

  beforeEach(async function () {
    [gov, user, user2] = await ethers.getSigners();

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    claimRegistry = await ClaimRegistry.deploy(await gov.getAddress());
  });

  describe("Constructor and Setup", function () {
    it("should deploy with correct roles", async function () {
      expect(await claimRegistry.hasRole(await claimRegistry.GOV_ROLE(), await gov.getAddress())).to.be.true;
      expect(await claimRegistry.hasRole(await claimRegistry.ECC_ROLE(), await gov.getAddress())).to.be.true;
      expect(await claimRegistry.hasRole(await claimRegistry.OPS_ROLE(), await gov.getAddress())).to.be.true;
    });
  });

  describe("Claim Triggering", function () {
    it("should allow ECC to trigger claim", async function () {
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      const jurisdiction = "US";
      const baseLoss = ethers.parseUnits("1000000", 6); // 1M USDC
      const coveredLoss = ethers.parseUnits("800000", 6); // 800K USDC
      const reason = "Test sovereign guarantee claim";
      
      await expect(claimRegistry.connect(gov).triggerClaim(dossierHash, jurisdiction, baseLoss, coveredLoss, reason))
        .to.emit(claimRegistry, "ClaimTriggered")
        .withArgs(1, reason, baseLoss, coveredLoss);
      
      const claim = await claimRegistry.claims(1);
      expect(claim.dossierHash).to.equal(dossierHash);
      expect(claim.jurisdiction).to.equal(jurisdiction);
      expect(claim.baseLoss).to.equal(baseLoss);
      expect(claim.coveredLoss).to.equal(coveredLoss);
      expect(claim.isActive).to.be.true;
      expect(claim.isSettled).to.be.false;
    });

    it("should reject non-ECC triggering claim", async function () {
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      const jurisdiction = "US";
      const baseLoss = ethers.parseUnits("1000000", 6);
      const coveredLoss = ethers.parseUnits("800000", 6);
      const reason = "Test claim";
      
      await expect(
        claimRegistry.connect(user).triggerClaim(dossierHash, jurisdiction, baseLoss, coveredLoss, reason)
      ).to.be.revertedWithCustomError(claimRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Claim Lifecycle", function () {
    it("should allow OPS to serve notice", async function () {
      // First trigger a claim
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      await claimRegistry.connect(gov).triggerClaim(dossierHash, "US", ethers.parseUnits("1000000", 6), ethers.parseUnits("800000", 6), "Test claim");
      
      // Then serve notice
      const newDossierHash = ethers.keccak256(ethers.toUtf8Bytes("updated-dossier"));
      await expect(claimRegistry.connect(gov).serveNotice(1, newDossierHash))
        .to.emit(claimRegistry, "NoticeServed")
        .withArgs(1, newDossierHash, "US", anyValue);
    });

    it("should allow OPS to record acknowledgment", async function () {
      // First trigger a claim and serve notice
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      await claimRegistry.connect(gov).triggerClaim(dossierHash, "US", ethers.parseUnits("1000000", 6), ethers.parseUnits("800000", 6), "Test claim");
      await claimRegistry.connect(gov).serveNotice(1, dossierHash);
      
      // Then record acknowledgment
      const refNo = "SG-2024-001";
      await expect(claimRegistry.connect(gov).recordAcknowledgment(1, refNo))
        .to.emit(claimRegistry, "Acknowledged")
        .withArgs(1, anyValue, refNo);
    });

    it("should allow OPS to schedule payment", async function () {
      // First trigger a claim, serve notice, and record acknowledgment
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      await claimRegistry.connect(gov).triggerClaim(dossierHash, "US", ethers.parseUnits("1000000", 6), ethers.parseUnits("800000", 6), "Test claim");
      await claimRegistry.connect(gov).serveNotice(1, dossierHash);
      await claimRegistry.connect(gov).recordAcknowledgment(1, "SG-2024-001");
      
      // Then schedule payment
      const amount = ethers.parseUnits("500000", 6);
      await expect(claimRegistry.connect(gov).schedulePayment(1, amount))
        .to.emit(claimRegistry, "ScheduledPayment")
        .withArgs(1, anyValue, amount);
    });

    it("should allow OPS to record settlement", async function () {
      // First trigger a claim
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      await claimRegistry.connect(gov).triggerClaim(dossierHash, "US", ethers.parseUnits("1000000", 6), ethers.parseUnits("800000", 6), "Test claim");
      
      // Then record settlement
      const amount = ethers.parseUnits("800000", 6);
      await expect(claimRegistry.connect(gov).recordSettlement(1, amount))
        .to.emit(claimRegistry, "Settlement")
        .withArgs(1, anyValue, amount, "");
    });
  });

  describe("Sovereign Guarantee", function () {
    it("should allow GOV to confirm sovereign guarantee", async function () {
      await expect(claimRegistry.connect(gov).confirmSovereignGuarantee(true, "Test confirmation"))
        .to.emit(claimRegistry, "SovereignGuaranteeConfirmed")
        .withArgs(true, "Test confirmation");
      
      expect(await claimRegistry.sovereignGuaranteeConfirmed()).to.be.true;
    });
  });

  describe("Claim Reading", function () {
    it("should return correct claim data", async function () {
      const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("test-dossier"));
      await claimRegistry.connect(gov).triggerClaim(dossierHash, "US", ethers.parseUnits("1000000", 6), ethers.parseUnits("800000", 6), "Test claim");
      
      const claim = await claimRegistry.claims(1);
      expect(claim.dossierHash).to.equal(dossierHash);
      expect(claim.jurisdiction).to.equal("US");
      expect(claim.baseLoss).to.equal(ethers.parseUnits("1000000", 6));
      expect(claim.coveredLoss).to.equal(ethers.parseUnits("800000", 6));
      expect(claim.isActive).to.be.true;
      expect(claim.isSettled).to.be.false;
    });

    it("should return default values for non-existent claim", async function () {
      const claim = await claimRegistry.claims(999);
      expect(claim.dossierHash).to.equal(ethers.ZeroHash);
      expect(claim.jurisdiction).to.equal("");
      expect(claim.baseLoss).to.equal(0);
      expect(claim.coveredLoss).to.equal(0);
      expect(claim.isActive).to.be.false;
      expect(claim.isSettled).to.be.false;
    });
  });
});
