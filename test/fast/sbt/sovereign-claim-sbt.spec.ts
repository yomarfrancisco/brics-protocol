import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SovereignClaimSBT: lifecycle and soulbound functionality", () => {
  let sbt: any;
  let owner: any;
  let gov: any;
  let sov: any;
  let ecc: any;
  let user1: any;
  let user2: any;

  const REDEMPTION_ID = 123;
  const USDC_NOTIONAL = 1000000; // 1M USDC (6 decimals)
  const ISDA_ANNEX_HASH = ethers.keccak256(ethers.toUtf8Bytes("ISDA Annex"));
  const DOCS_BUNDLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("Docs Bundle"));
  const EVIDENCE_URI = "ipfs://QmEvidence";

  beforeEach(async () => {
    [owner, gov, sov, ecc, user1, user2] = await ethers.getSigners();

    const SovereignClaimSBT = await ethers.getContractFactory("SovereignClaimSBT");
    sbt = await SovereignClaimSBT.deploy(
      "Sovereign Claim SBT",
      "SOV-CLAIM",
      await gov.getAddress()
    );
    await sbt.waitForDeployment();

    // Grant roles
    await sbt.connect(gov).grantRole(await sbt.SOV_ROLE(), await sov.getAddress());
    await sbt.connect(gov).grantRole(await sbt.ECC_ROLE(), await ecc.getAddress());
  });

  describe("Mint / file", () => {
    it("creates SBT with correct fields, status=Filed", async () => {
      await expect(
        sbt.connect(gov).fileClaim(
          await user1.getAddress(),
          REDEMPTION_ID,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.emit(sbt, "Filed").withArgs(1, REDEMPTION_ID, USDC_NOTIONAL);

      const claim = await sbt.getClaim(1);
      expect(claim.redemptionId).to.equal(REDEMPTION_ID);
      expect(claim.usdcNotional).to.equal(USDC_NOTIONAL);
      expect(claim.isdaAnnexHash).to.equal(ISDA_ANNEX_HASH);
      expect(claim.docsBundleHash).to.equal(DOCS_BUNDLE_HASH);
      expect(claim.evidenceURI).to.equal(EVIDENCE_URI);
      expect(claim.status).to.equal(0); // Filed
      expect(claim.filedAt).to.be.gt(0);
      expect(claim.ackAt).to.equal(0);
      expect(claim.paidAt).to.equal(0);
      expect(claim.reimbursedAt).to.equal(0);
      expect(claim.closedAt).to.equal(0);

      expect(await sbt.ownerOf(1)).to.equal(await user1.getAddress());
    });

    it("non-authorized callers revert", async () => {
      await expect(
        sbt.connect(user1).fileClaim(
          await user1.getAddress(),
          REDEMPTION_ID,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");
    });

    it("ECC_ROLE can file claims", async () => {
      await expect(
        sbt.connect(ecc).fileClaim(
          await user1.getAddress(),
          REDEMPTION_ID,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.emit(sbt, "Filed").withArgs(1, REDEMPTION_ID, USDC_NOTIONAL);
    });

    it("increments token ID counter", async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );

      await sbt.connect(gov).fileClaim(
        await user2.getAddress(),
        REDEMPTION_ID + 1,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );

      expect(await sbt.ownerOf(1)).to.equal(await user1.getAddress());
      expect(await sbt.ownerOf(2)).to.equal(await user2.getAddress());
    });
  });

  describe("Hashes + URI", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("updating during Filed status", async () => {
      const newIsdaHash = ethers.keccak256(ethers.toUtf8Bytes("New ISDA"));
      const newDocsHash = ethers.keccak256(ethers.toUtf8Bytes("New Docs"));

      await expect(
        sbt.connect(gov).setHashes(tokenId, newIsdaHash, newDocsHash)
      ).to.emit(sbt, "HashesSet").withArgs(tokenId, newIsdaHash, newDocsHash);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.isdaAnnexHash).to.equal(newIsdaHash);
      expect(claim.docsBundleHash).to.equal(newDocsHash);
    });

    it("updating during Acknowledged status", async () => {
      await sbt.connect(sov).acknowledge(tokenId);

      const newIsdaHash = ethers.keccak256(ethers.toUtf8Bytes("New ISDA"));
      const newDocsHash = ethers.keccak256(ethers.toUtf8Bytes("New Docs"));

      await expect(
        sbt.connect(gov).setHashes(tokenId, newIsdaHash, newDocsHash)
      ).to.emit(sbt, "HashesSet").withArgs(tokenId, newIsdaHash, newDocsHash);
    });

    it("reverts after PaidToSPV", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);

      const newIsdaHash = ethers.keccak256(ethers.toUtf8Bytes("New ISDA"));
      const newDocsHash = ethers.keccak256(ethers.toUtf8Bytes("New Docs"));

      await expect(
        sbt.connect(gov).setHashes(tokenId, newIsdaHash, newDocsHash)
      ).to.be.revertedWithCustomError(sbt, "SBT_INVALID_STATUS");
    });

    it("setEvidenceURI always allowed", async () => {
      const newURI = "ipfs://QmNewEvidence";
      await expect(
        sbt.connect(gov).setEvidenceURI(tokenId, newURI)
      ).to.emit(sbt, "URISet").withArgs(tokenId, newURI);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.evidenceURI).to.equal(newURI);
    });

    it("non-gov cannot set hashes", async () => {
      const newIsdaHash = ethers.keccak256(ethers.toUtf8Bytes("New ISDA"));
      const newDocsHash = ethers.keccak256(ethers.toUtf8Bytes("New Docs"));

      await expect(
        sbt.connect(user1).setHashes(tokenId, newIsdaHash, newDocsHash)
      ).to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");
    });

    it("non-gov cannot set evidence URI", async () => {
      await expect(
        sbt.connect(user1).setEvidenceURI(tokenId, "new-uri")
      ).to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");
    });
  });

  describe("Lifecycle monotonicity", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("Filed → Acknowledged", async () => {
      await expect(sbt.connect(sov).acknowledge(tokenId))
        .to.emit(sbt, "Acknowledged").withArgs(tokenId);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.status).to.equal(1); // Acknowledged
      expect(claim.ackAt).to.be.gt(0);
    });

    it("Acknowledged → PaidToSPV", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      
      await expect(sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL))
        .to.emit(sbt, "PaidToSPV").withArgs(tokenId, USDC_NOTIONAL);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.status).to.equal(2); // PaidToSPV
      expect(claim.paidAt).to.be.gt(0);
    });

    it("PaidToSPV → ReimbursedBySovereign", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      
      await expect(sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL))
        .to.emit(sbt, "Reimbursed").withArgs(tokenId, USDC_NOTIONAL);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.status).to.equal(3); // ReimbursedBySovereign
      expect(claim.reimbursedAt).to.be.gt(0);
    });

    it("ReimbursedBySovereign → Closed", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      
      await expect(sbt.connect(gov).close(tokenId))
        .to.emit(sbt, "Closed").withArgs(tokenId);

      const claim = await sbt.getClaim(tokenId);
      expect(claim.status).to.equal(4); // Closed
      expect(claim.closedAt).to.be.gt(0);
    });

    it("any backward/skip reverts SBT_ONLY_FORWARD", async () => {
      // Try to acknowledge twice
      await sbt.connect(sov).acknowledge(tokenId);
      await expect(sbt.connect(sov).acknowledge(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");

      // Try to mark paid without acknowledging
      await sbt.connect(gov).fileClaim(
        await user2.getAddress(),
        REDEMPTION_ID + 1,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      await expect(sbt.connect(sov).markPaidToSPV(2, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");

      // Try to close without reimbursement
      await sbt.connect(sov).acknowledge(2);
      await sbt.connect(sov).markPaidToSPV(2, USDC_NOTIONAL);
      await expect(sbt.connect(gov).close(2))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");
    });

    it("GOV_ROLE can mark reimbursed", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      
      await expect(sbt.connect(gov).markReimbursed(tokenId, USDC_NOTIONAL))
        .to.emit(sbt, "Reimbursed").withArgs(tokenId, USDC_NOTIONAL);
    });

    it("non-authorized roles cannot progress lifecycle", async () => {
      // Non-SOV cannot acknowledge
      await expect(sbt.connect(user1).acknowledge(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Non-SOV cannot mark paid
      await expect(sbt.connect(user1).markPaidToSPV(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Non-SOV/GOV cannot mark reimbursed
      await expect(sbt.connect(user1).markReimbursed(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Non-GOV cannot close
      await expect(sbt.connect(user1).close(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");
    });
  });

  describe("Burn rules", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("only GOV can burn when Closed", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      await sbt.connect(gov).close(tokenId);

      await expect(sbt.connect(gov).burn(tokenId)).to.not.be.reverted;
      await expect(sbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("owner can burn when Closed", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      await sbt.connect(gov).close(tokenId);

      await expect(sbt.connect(user1).burn(tokenId)).to.not.be.reverted;
      await expect(sbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("earlier states revert", async () => {
      // Filed state
      await expect(sbt.connect(gov).burn(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");

      // Acknowledged state
      await sbt.connect(sov).acknowledge(tokenId);
      await expect(sbt.connect(gov).burn(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");

      // PaidToSPV state
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await expect(sbt.connect(gov).burn(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");

      // ReimbursedBySovereign state
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      await expect(sbt.connect(gov).burn(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_FORWARD");
    });

    it("non-owner and non-gov cannot burn", async () => {
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      await sbt.connect(gov).close(tokenId);

      await expect(sbt.connect(user2).burn(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_NOT_OWNER_OR_GOV");
    });
  });

  describe("soulbound enforcement", () => {
    it("reverts transfers and approvals", async () => {
      const [admin, alice, bob] = await ethers.getSigners();
      const aliceAddr = await alice.getAddress();
      const bobAddr = await bob.getAddress();

      // Mint token to alice
      await sbt.connect(gov).fileClaim(
        aliceAddr,
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );

      // approve/approvalForAll
      await expect(sbt.connect(alice).approve(bobAddr, 1n)).to.be.revertedWith("SBT/NO_TRANSFER");
      await expect(sbt.connect(alice).setApprovalForAll(bobAddr, true)).to.be.revertedWith("SBT/NO_TRANSFER");

      // transferFrom
      await expect(sbt.connect(alice).transferFrom(aliceAddr, bobAddr, 1n)).to.be.revertedWith("SBT/NO_TRANSFER");

      // safeTransferFrom (bytes overload) - use explicit signature to avoid ambiguity
      await expect(
        sbt.connect(alice)["safeTransferFrom(address,address,uint256,bytes)"](aliceAddr, bobAddr, 1n, "0x")
      ).to.be.revertedWith("SBT/NO_TRANSFER");
    });
  });

  describe("Pause", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("state changes revert with EnforcedPause", async () => {
      await sbt.connect(gov).pause();

      // fileClaim
      await expect(
        sbt.connect(gov).fileClaim(
          await user2.getAddress(),
          REDEMPTION_ID + 1,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.be.revertedWithCustomError(sbt, "EnforcedPause");

      // acknowledge
      await expect(sbt.connect(sov).acknowledge(tokenId))
        .to.be.revertedWithCustomError(sbt, "EnforcedPause");

      // markPaidToSPV
      await sbt.connect(gov).unpause();
      await sbt.connect(sov).acknowledge(tokenId);
      await sbt.connect(gov).pause();
      await expect(sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "EnforcedPause");

      // markReimbursed
      await sbt.connect(gov).unpause();
      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      await sbt.connect(gov).pause();
      await expect(sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "EnforcedPause");

      // close
      await sbt.connect(gov).unpause();
      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      await sbt.connect(gov).pause();
      await expect(sbt.connect(gov).close(tokenId))
        .to.be.revertedWithCustomError(sbt, "EnforcedPause");
    });

    it("unpause restores functionality", async () => {
      await sbt.connect(gov).pause();
      await sbt.connect(gov).unpause();

      await expect(sbt.connect(sov).acknowledge(tokenId))
        .to.emit(sbt, "Acknowledged").withArgs(tokenId);
    });

    it("non-gov cannot pause/unpause", async () => {
      await expect(sbt.connect(user1).pause())
        .to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");
      
      await expect(sbt.connect(user1).unpause())
        .to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Access control", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("role requirements enforced for each function", async () => {
      // Only GOV/ECC can fileClaim
      await expect(
        sbt.connect(user1).fileClaim(
          await user2.getAddress(),
          REDEMPTION_ID + 1,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only SOV can acknowledge
      await expect(sbt.connect(user1).acknowledge(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only SOV can markPaidToSPV
      await expect(sbt.connect(user1).markPaidToSPV(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only SOV/GOV can markReimbursed
      await expect(sbt.connect(user1).markReimbursed(tokenId, USDC_NOTIONAL))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only GOV can close
      await expect(sbt.connect(user1).close(tokenId))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only GOV can setHashes
      await expect(sbt.connect(user1).setHashes(tokenId, ISDA_ANNEX_HASH, DOCS_BUNDLE_HASH))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");

      // Only GOV can setEvidenceURI
      await expect(sbt.connect(user1).setEvidenceURI(tokenId, "new-uri"))
        .to.be.revertedWithCustomError(sbt, "SBT_ONLY_ROLE");
    });
  });

  describe("Linkage", () => {
    it("token stores redemptionId and usdcNotional properly", async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );

      expect(await sbt.getRedemptionId(1)).to.equal(REDEMPTION_ID);
      expect(await sbt.getUsdcNotional(1)).to.equal(USDC_NOTIONAL);

      const claim = await sbt.getClaim(1);
      expect(claim.redemptionId).to.equal(REDEMPTION_ID);
      expect(claim.usdcNotional).to.equal(USDC_NOTIONAL);
    });
  });

  describe("Events", () => {
    it("assert all event emissions with expected args", async () => {
      // fileClaim
      await expect(
        sbt.connect(gov).fileClaim(
          await user1.getAddress(),
          REDEMPTION_ID,
          USDC_NOTIONAL,
          ISDA_ANNEX_HASH,
          DOCS_BUNDLE_HASH,
          EVIDENCE_URI
        )
      ).to.emit(sbt, "Filed").withArgs(1, REDEMPTION_ID, USDC_NOTIONAL);

      // acknowledge
      await expect(sbt.connect(sov).acknowledge(1))
        .to.emit(sbt, "Acknowledged").withArgs(1);

      // markPaidToSPV
      await expect(sbt.connect(sov).markPaidToSPV(1, USDC_NOTIONAL))
        .to.emit(sbt, "PaidToSPV").withArgs(1, USDC_NOTIONAL);

      // markReimbursed
      await expect(sbt.connect(sov).markReimbursed(1, USDC_NOTIONAL))
        .to.emit(sbt, "Reimbursed").withArgs(1, USDC_NOTIONAL);

      // close
      await expect(sbt.connect(gov).close(1))
        .to.emit(sbt, "Closed").withArgs(1);

      // setHashes - create a new token for this test since token 1 is already closed
      await sbt.connect(gov).fileClaim(
        await user2.getAddress(),
        REDEMPTION_ID + 1,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      const newIsdaHash = ethers.keccak256(ethers.toUtf8Bytes("New ISDA"));
      const newDocsHash = ethers.keccak256(ethers.toUtf8Bytes("New Docs"));
      await expect(sbt.connect(gov).setHashes(2, newIsdaHash, newDocsHash))
        .to.emit(sbt, "HashesSet").withArgs(2, newIsdaHash, newDocsHash);

      // setEvidenceURI
      await expect(sbt.connect(gov).setEvidenceURI(1, "new-uri"))
        .to.emit(sbt, "URISet").withArgs(1, "new-uri");
    });
  });

  describe("View functions", () => {
    let tokenId: number;

    beforeEach(async () => {
      await sbt.connect(gov).fileClaim(
        await user1.getAddress(),
        REDEMPTION_ID,
        USDC_NOTIONAL,
        ISDA_ANNEX_HASH,
        DOCS_BUNDLE_HASH,
        EVIDENCE_URI
      );
      tokenId = 1;
    });

    it("getStatus returns correct status", async () => {
      expect(await sbt.getStatus(tokenId)).to.equal(0); // Filed

      await sbt.connect(sov).acknowledge(tokenId);
      expect(await sbt.getStatus(tokenId)).to.equal(1); // Acknowledged

      await sbt.connect(sov).markPaidToSPV(tokenId, USDC_NOTIONAL);
      expect(await sbt.getStatus(tokenId)).to.equal(2); // PaidToSPV

      await sbt.connect(sov).markReimbursed(tokenId, USDC_NOTIONAL);
      expect(await sbt.getStatus(tokenId)).to.equal(3); // ReimbursedBySovereign

      await sbt.connect(gov).close(tokenId);
      expect(await sbt.getStatus(tokenId)).to.equal(4); // Closed
    });

    it("getClaim returns complete claim data", async () => {
      const claim = await sbt.getClaim(tokenId);
      expect(claim.redemptionId).to.equal(REDEMPTION_ID);
      expect(claim.usdcNotional).to.equal(USDC_NOTIONAL);
      expect(claim.isdaAnnexHash).to.equal(ISDA_ANNEX_HASH);
      expect(claim.docsBundleHash).to.equal(DOCS_BUNDLE_HASH);
      expect(claim.evidenceURI).to.equal(EVIDENCE_URI);
      expect(claim.status).to.equal(0); // Filed
      expect(claim.filedAt).to.be.gt(0);
    });
  });
});
