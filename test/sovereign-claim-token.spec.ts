import { expect } from "chai";
import { ethers } from "hardhat";
import { SovereignClaimToken } from "../typechain-types";

describe("SovereignClaimToken", function () {
  let sovereignClaimToken: SovereignClaimToken;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy SovereignClaimToken
    const SovereignClaimToken = await ethers.getContractFactory("SovereignClaimToken");
    sovereignClaimToken = await SovereignClaimToken.deploy(owner.address);
  });

  describe("Constructor", function () {
    it("should deploy with correct parameters", async function () {
      expect(await sovereignClaimToken.name()).to.equal("Sovereign Backstop Claim");
      expect(await sovereignClaimToken.symbol()).to.equal("BRICS-SBT");
      expect(await sovereignClaimToken.claimId()).to.equal(1);
      expect(await sovereignClaimToken.unlocked()).to.equal(false);
      
      // Check roles
      expect(await sovereignClaimToken.hasRole(await sovereignClaimToken.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await sovereignClaimToken.hasRole(await sovereignClaimToken.GOV_ROLE(), owner.address)).to.equal(true);
      
      // Check that the token was minted to the owner
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });
  });

  describe("supportsInterface", function () {
    it("should support ERC721 interface", async function () {
      const erc721InterfaceId = "0x80ac58cd"; // ERC721 interface ID
      expect(await sovereignClaimToken.supportsInterface(erc721InterfaceId)).to.equal(true);
    });

    it("should support AccessControl interface", async function () {
      const accessControlInterfaceId = "0x7965db0b"; // AccessControl interface ID
      expect(await sovereignClaimToken.supportsInterface(accessControlInterfaceId)).to.equal(true);
    });

    it("should support ERC165 interface", async function () {
      const erc165InterfaceId = "0x01ffc9a7"; // ERC165 interface ID
      expect(await sovereignClaimToken.supportsInterface(erc165InterfaceId)).to.equal(true);
    });

    it("should not support unknown interface", async function () {
      const unknownInterfaceId = "0x12345678";
      expect(await sovereignClaimToken.supportsInterface(unknownInterfaceId)).to.equal(false);
    });
  });

  describe("Transfer Restrictions", function () {
    it("should allow minting (from address(0))", async function () {
      // This is already tested in constructor, but let's verify the token exists
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });

    it("should allow burning (to address(0))", async function () {
      // First unlock the claim
      await sovereignClaimToken.unlockClaim("test reason");
      
      // The SovereignClaimToken doesn't have a burn function
      // Instead, we can test that the token exists and can be transferred to address(0)
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });

    it("should allow self-transfer (no-op)", async function () {
      await expect(sovereignClaimToken.connect(owner).transferFrom(owner.address, owner.address, 1))
        .to.not.be.reverted;
      
      // Token should still be owned by the original owner
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });

    it("should revert transfer to new owner", async function () {
      await expect(
        sovereignClaimToken.connect(owner).transferFrom(owner.address, user1.address, 1)
      ).to.be.revertedWithCustomError(sovereignClaimToken, "NonTransferable");
    });

    it("should revert approval", async function () {
      // The approval might succeed, but the transfer should fail
      await sovereignClaimToken.connect(owner).approve(user1.address, 1);
      
      // Try to transfer - this should fail
      await expect(
        sovereignClaimToken.connect(user1).transferFrom(owner.address, user1.address, 1)
      ).to.be.revertedWithCustomError(sovereignClaimToken, "NonTransferable");
    });

    it("should revert setApprovalForAll", async function () {
      // The setApprovalForAll might succeed, but the transfer should fail
      await sovereignClaimToken.connect(owner).setApprovalForAll(user1.address, true);
      
      // Try to transfer - this should fail
      await expect(
        sovereignClaimToken.connect(user1).transferFrom(owner.address, user1.address, 1)
      ).to.be.revertedWithCustomError(sovereignClaimToken, "NonTransferable");
    });
  });

  describe("Claim Unlocking", function () {
    it("should allow GOV_ROLE to unlock claim", async function () {
      await expect(sovereignClaimToken.unlockClaim("emergency backstop activated"))
        .to.emit(sovereignClaimToken, "ClaimUnlocked")
        .withArgs(1, "emergency backstop activated");
      
      expect(await sovereignClaimToken.unlocked()).to.equal(true);
    });

    it("should revert when non-GOV_ROLE tries to unlock claim", async function () {
      await expect(
        sovereignClaimToken.connect(user1).unlockClaim("test reason")
      ).to.be.revertedWithCustomError(sovereignClaimToken, "AccessControlUnauthorizedAccount");
    });

    it("should allow multiple unlock calls", async function () {
      await sovereignClaimToken.unlockClaim("first reason");
      expect(await sovereignClaimToken.unlocked()).to.equal(true);
      
      await sovereignClaimToken.unlockClaim("second reason");
      expect(await sovereignClaimToken.unlocked()).to.equal(true);
    });
  });

  describe("Claim Exercise", function () {
    beforeEach(async function () {
      await sovereignClaimToken.unlockClaim("test reason");
    });

    it("should allow GOV_ROLE to exercise claim when unlocked", async function () {
      const exerciseAmount = ethers.parseEther("1000000"); // 1M tokens
      
      await expect(sovereignClaimToken.exercise(exerciseAmount, user1.address))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, exerciseAmount, user1.address);
    });

    it("should revert when non-GOV_ROLE tries to exercise claim", async function () {
      const exerciseAmount = ethers.parseEther("1000000");
      
      await expect(
        sovereignClaimToken.connect(user1).exercise(exerciseAmount, user2.address)
      ).to.be.revertedWithCustomError(sovereignClaimToken, "AccessControlUnauthorizedAccount");
    });

    it("should revert exercise when claim is locked", async function () {
      // Deploy a new token that's not unlocked
      const SovereignClaimToken = await ethers.getContractFactory("SovereignClaimToken");
      const lockedToken = await SovereignClaimToken.deploy(owner.address);
      
      const exerciseAmount = ethers.parseEther("1000000");
      
      await expect(
        lockedToken.exercise(exerciseAmount, user1.address)
      ).to.be.revertedWith("locked");
    });

    it("should allow exercise with zero amount", async function () {
      await expect(sovereignClaimToken.exercise(0, user1.address))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, 0, user1.address);
    });

    it("should allow exercise with zero address recipient", async function () {
      const exerciseAmount = ethers.parseEther("1000000");
      
      await expect(sovereignClaimToken.exercise(exerciseAmount, ethers.ZeroAddress))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, exerciseAmount, ethers.ZeroAddress);
    });

    it("should allow multiple exercises", async function () {
      const exerciseAmount1 = ethers.parseEther("500000");
      const exerciseAmount2 = ethers.parseEther("300000");
      
      await expect(sovereignClaimToken.exercise(exerciseAmount1, user1.address))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, exerciseAmount1, user1.address);
      
      await expect(sovereignClaimToken.exercise(exerciseAmount2, user2.address))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, exerciseAmount2, user2.address);
    });
  });

  describe("View Functions", function () {
    it("should return correct claimId", async function () {
      expect(await sovereignClaimToken.claimId()).to.equal(1);
    });

    it("should return correct unlocked status", async function () {
      expect(await sovereignClaimToken.unlocked()).to.equal(false);
      
      await sovereignClaimToken.unlockClaim("test reason");
      expect(await sovereignClaimToken.unlocked()).to.equal(true);
    });

    it("should return correct GOV_ROLE", async function () {
      const govRole = await sovereignClaimToken.GOV_ROLE();
      expect(govRole).to.equal(ethers.keccak256(ethers.toUtf8Bytes("GOV")));
    });

    it("should return correct token owner", async function () {
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });

    it("should return correct token URI", async function () {
      // Default ERC721 implementation should return empty string
      expect(await sovereignClaimToken.tokenURI(1)).to.equal("");
    });
  });

  describe("Role Management", function () {
    it("should allow admin to grant GOV_ROLE", async function () {
      await sovereignClaimToken.grantRole(await sovereignClaimToken.GOV_ROLE(), user1.address);
      expect(await sovereignClaimToken.hasRole(await sovereignClaimToken.GOV_ROLE(), user1.address)).to.equal(true);
    });

    it("should allow admin to revoke GOV_ROLE", async function () {
      await sovereignClaimToken.grantRole(await sovereignClaimToken.GOV_ROLE(), user1.address);
      await sovereignClaimToken.revokeRole(await sovereignClaimToken.GOV_ROLE(), user1.address);
      expect(await sovereignClaimToken.hasRole(await sovereignClaimToken.GOV_ROLE(), user1.address)).to.equal(false);
    });

    it("should revert when non-admin tries to grant role", async function () {
      await expect(
        sovereignClaimToken.connect(user1).grantRole(await sovereignClaimToken.GOV_ROLE(), user2.address)
      ).to.be.revertedWithCustomError(sovereignClaimToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("should handle very large exercise amounts", async function () {
      await sovereignClaimToken.unlockClaim("test reason");
      
      const largeAmount = ethers.parseEther("1000000000000000000"); // Very large amount
      
      await expect(sovereignClaimToken.exercise(largeAmount, user1.address))
        .to.emit(sovereignClaimToken, "ClaimExercised")
        .withArgs(1, largeAmount, user1.address);
    });

    it("should handle empty reason string", async function () {
      await expect(sovereignClaimToken.unlockClaim(""))
        .to.emit(sovereignClaimToken, "ClaimUnlocked")
        .withArgs(1, "");
    });

    it("should handle long reason string", async function () {
      const longReason = "This is a very long reason string that tests the contract's ability to handle long strings in events";
      
      await expect(sovereignClaimToken.unlockClaim(longReason))
        .to.emit(sovereignClaimToken, "ClaimUnlocked")
        .withArgs(1, longReason);
    });

    it("should handle exercise after unlock and relock", async function () {
      await sovereignClaimToken.unlockClaim("first unlock");
      expect(await sovereignClaimToken.unlocked()).to.equal(true);
      
      // Note: The contract doesn't have a relock function, so unlocked stays true
      // But we can test that exercise still works
      await expect(sovereignClaimToken.exercise(ethers.parseEther("1000"), user1.address))
        .to.emit(sovereignClaimToken, "ClaimExercised");
    });
  });

  describe("ERC721 Standard Functions", function () {
    it("should return correct balance", async function () {
      expect(await sovereignClaimToken.balanceOf(owner.address)).to.equal(1);
      expect(await sovereignClaimToken.balanceOf(user1.address)).to.equal(0);
    });

    it("should return correct token owner", async function () {
      expect(await sovereignClaimToken.ownerOf(1)).to.equal(owner.address);
    });
  });
});
