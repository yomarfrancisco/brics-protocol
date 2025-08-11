import { expect } from "chai";
import { ethers } from "hardhat";
import { TrancheManagerV2 } from "../../../typechain-types";

describe("TrancheManagerV2 Existing Functions Fast Tests", function () {
  let trancheManager: TrancheManagerV2;
  let gov: any;
  let ecc: any;
  let user: any;

  beforeEach(async function () {
    [gov, ecc, user] = await ethers.getSigners();

    // Deploy TrancheManagerV2
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      await gov.getAddress(),
      await gov.getAddress(), // mock oracle
      await gov.getAddress()  // mock config
    );

    // Grant ECC role
    await trancheManager.grantRole(await trancheManager.ECC_ROLE(), await ecc.getAddress());
  });

  describe("Existing Functions Coverage", function () {
    it("should allow gov to set claim registry", async function () {
      const claimRegistry = await ethers.getContractFactory("ClaimRegistry");
      const mockClaimRegistry = await claimRegistry.deploy(await gov.getAddress());
      
      await trancheManager.connect(gov).setClaimRegistry(await mockClaimRegistry.getAddress());
      expect(await trancheManager.claimRegistry()).to.equal(await mockClaimRegistry.getAddress());
    });

    it("should allow gov to confirm sovereign guarantee", async function () {
      await expect(trancheManager.connect(gov).confirmSovereignGuarantee(true))
        .to.emit(trancheManager, "SovereignGuaranteeConfirmed")
        .withArgs(true);
      
      expect(await trancheManager.sovereignGuaranteeConfirmed()).to.be.true;
    });

    it("should allow gov to adjust super senior cap", async function () {
      await expect(trancheManager.connect(gov).adjustSuperSeniorCap(ethers.parseUnits("1000000", 6)))
        .to.emit(trancheManager, "CapAdjusted")
        .withArgs(ethers.parseUnits("1000000", 6));
      
      expect(await trancheManager.superSeniorCap()).to.equal(ethers.parseUnits("1000000", 6));
    });

    it("should allow gov to set issuance locked", async function () {
      await expect(trancheManager.connect(gov).setIssuanceLocked(true))
        .to.emit(trancheManager, "IssuanceLocked")
        .withArgs(true);
      
      expect(await trancheManager.issuanceLocked()).to.be.true;
    });

    it("should allow ECC to set issuance locked", async function () {
      await expect(trancheManager.connect(ecc).setIssuanceLocked(false))
        .to.emit(trancheManager, "IssuanceLocked")
        .withArgs(false);
      
      expect(await trancheManager.issuanceLocked()).to.be.false;
    });

    it("should revert when unauthorized user sets issuance locked", async function () {
      await expect(
        trancheManager.connect(user).setIssuanceLocked(true)
      ).to.be.revertedWith("unauthorized");
    });

    it("should allow gov to set triggers breached", async function () {
      await expect(trancheManager.connect(gov).setTriggersBreached(true))
        .to.emit(trancheManager, "TriggersBreachedSet")
        .withArgs(true);
      
      expect(await trancheManager.triggersBreached()).to.be.true;
    });

    it("should allow ECC to set triggers breached", async function () {
      await expect(trancheManager.connect(ecc).setTriggersBreached(false))
        .to.emit(trancheManager, "TriggersBreachedSet")
        .withArgs(false);
      
      expect(await trancheManager.triggersBreached()).to.be.false;
    });

    it("should revert when unauthorized user sets triggers breached", async function () {
      await expect(
        trancheManager.connect(user).setTriggersBreached(true)
      ).to.be.revertedWith("unauthorized");
    });

    it("should allow gov to attest supermajority", async function () {
      await expect(trancheManager.connect(gov).attestSupermajority(6700))
        .to.emit(trancheManager, "SupermajorityAttested");
      
      expect(await trancheManager.lastVoteYesBps()).to.equal(6700);
    });

    it("should allow ECC to attest supermajority", async function () {
      await expect(trancheManager.connect(ecc).attestSupermajority(8000))
        .to.emit(trancheManager, "SupermajorityAttested");
      
      expect(await trancheManager.lastVoteYesBps()).to.equal(8000);
    });

    it("should revert when attesting supermajority with invalid bps", async function () {
      await expect(
        trancheManager.connect(gov).attestSupermajority(10001)
      ).to.be.revertedWith("bad bps");
    });

    it("should revert when unauthorized user attests supermajority", async function () {
      await expect(
        trancheManager.connect(user).attestSupermajority(6700)
      ).to.be.revertedWith("unauthorized");
    });

    it("should return effective detachment in normal mode", async function () {
      const [lo, hi] = await trancheManager.getEffectiveDetachment();
      expect(lo).to.equal(10000); // bricsLo
      expect(hi).to.equal(10200); // bricsHi
    });
  });
});
