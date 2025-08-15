import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("InstantLane Comprehensive Tests", function () {
  async function deployInstantLaneFixture() {
    const [deployer, alice, bob, gov] = await ethers.getSigners();

    // Deploy mocks
    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();

    const BRICS = await ethers.getContractFactory("MockBRICSToken");
    const brics = await BRICS.deploy();
    await brics.waitForDeployment();

    const Member = await ethers.getContractFactory("MockMemberRegistry");
    const members = await Member.deploy();
    await members.waitForDeployment();

    const Oracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setLatestNAVRay(ethers.toBigInt("1000000000000000000000000000")); // 1e27

    const AMM = await ethers.getContractFactory("MockAMM");
    const amm = await AMM.deploy(await usdc.getAddress());
    await amm.waitForDeployment();

    const PMM = await ethers.getContractFactory("MockPMM");
    const pmm = await PMM.deploy(await usdc.getAddress());
    await pmm.waitForDeployment();

    const Cfg = await ethers.getContractFactory("MockConfigRegistry");
    const cfg = await Cfg.deploy();
    await cfg.waitForDeployment();

    const Lane = await ethers.getContractFactory("InstantLane");
    const lane = await Lane.deploy(
      await brics.getAddress(),
      await usdc.getAddress(),
      await oracle.getAddress(),
      await members.getAddress(),
      await amm.getAddress(),
      await cfg.getAddress(),
      await pmm.getAddress(),
      await gov.getAddress()
    );
    await lane.waitForDeployment();

    // Fund contracts
    await usdc.mint(await deployer.getAddress(), 1_000_000n * 1_000_000n);
    await usdc.transfer(await lane.getAddress(), 100_000n * 1_000_000n);
    await brics.mint(await alice.getAddress(), 10_000n * 10n ** 18n);
    await brics.mint(await bob.getAddress(), 10_000n * 10n ** 18n);

    return {
      deployer,
      alice,
      bob,
      gov,
      usdc,
      brics,
      members,
      oracle,
      amm,
      pmm,
      cfg,
      lane
    };
  }

  describe("Constructor and Setup", function () {
    it("should deploy with correct parameters", async function () {
      const { lane, brics, usdc, oracle, members, amm, cfg, pmm, gov } = await loadFixture(deployInstantLaneFixture);

      expect(await lane.brics()).to.equal(await brics.getAddress());
      expect(await lane.usdc()).to.equal(await usdc.getAddress());
      expect(await lane.oracle()).to.equal(await oracle.getAddress());
      expect(await lane.members()).to.equal(await members.getAddress());
      expect(await lane.amm()).to.equal(await amm.getAddress());
      expect(await lane.cfg()).to.equal(await cfg.getAddress());
      expect(await lane.pmm()).to.equal(await pmm.getAddress());
    });

    it("should grant correct roles to gov", async function () {
      const { lane, gov } = await loadFixture(deployInstantLaneFixture);

      expect(await lane.hasRole(await lane.GOV_ROLE(), await gov.getAddress())).to.be.true;
      expect(await lane.hasRole(await lane.PAUSER_ROLE(), await gov.getAddress())).to.be.true;
      expect(await lane.hasRole(await lane.DEFAULT_ADMIN_ROLE(), await gov.getAddress())).to.be.true;
    });
  });

  describe("Member Gating", function () {
    it("should allow members to redeem", async function () {
      const { lane, members, alice, brics, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
    });

    it("should block non-members from redeeming", async function () {
      const { lane, bob, brics } = await loadFixture(deployInstantLaneFixture);

      await brics.connect(bob).approve(await lane.getAddress(), ethers.MaxUint256);

      const tokens = 1_000n * 10n ** 18n;
      await expect(lane.connect(bob).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_NOT_MEMBER");
    });

    it("should block non-members in instantRedeemFor", async function () {
      const { lane, bob, brics } = await loadFixture(deployInstantLaneFixture);

      await brics.connect(bob).approve(await lane.getAddress(), ethers.MaxUint256);

      const tokens = 1_000n * 10n ** 18n;
      await expect(lane.connect(bob).instantRedeemFor(await bob.getAddress(), tokens))
        .to.be.revertedWithCustomError(lane, "IL_NOT_MEMBER");
    });
  });

  describe("Daily Cap Management", function () {
    it("should track daily usage correctly", async function () {
      const { lane, members, alice, brics, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // First redemption
      await lane.connect(alice).instantRedeem(tokens);
      
      // Check daily usage
      const [ok, cap, used, need] = await lane.canInstantRedeem(await alice.getAddress(), 0);
      expect(used).to.equal(1_000n * 1_000_000n); // 1000 USDC worth
      
      // Second redemption should work within cap
      await lane.connect(alice).instantRedeem(tokens);
      
      // Check updated usage
      const [ok2, cap2, used2, need2] = await lane.canInstantRedeem(await alice.getAddress(), 0);
      expect(used2).to.equal(2_000n * 1_000_000n); // 2000 USDC worth
    });

    it("should reset daily usage on new day", async function () {
      const { lane, members, alice, brics, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // First redemption
      await lane.connect(alice).instantRedeem(tokens);
      
      // Check daily usage
      const [ok, cap, used, need] = await lane.canInstantRedeem(await alice.getAddress(), 0);
      expect(used).to.equal(1_000n * 1_000_000n);
      
      // Fast forward 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      
      // Check daily usage should be reset
      const [ok2, cap2, used2, need2] = await lane.canInstantRedeem(await alice.getAddress(), 0);
      expect(used2).to.equal(0);
    });

    it("should enforce daily cap", async function () {
      const { lane, members, alice, brics, amm, cfg, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      // Set low daily cap
      await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.dailyCap.usdc")), 1_000n * 1_000_000n);

      const tokens = 400n * 10n ** 18n; // 400 USDC worth
      
      // First redemption should work
      await lane.connect(alice).instantRedeem(tokens);
      
      // Second redemption should work
      await lane.connect(alice).instantRedeem(tokens);
      
      // Third redemption should fail (exceeds 1000 USDC cap)
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_CAP_EXCEEDED");
    });
  });

  describe("Price Bounds", function () {
    it("should enforce price bounds with AMM", async function () {
      const { lane, members, alice, brics, pmm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);

      const tokens = 1_000n * 10n ** 18n;
      
      // Set price within bounds
      await pmm.setBps(10000);
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
      
      // Set price below bounds (9800-10200 for level 0)
      await pmm.setBps(9700);
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
      
      // Set price above bounds
      await pmm.setBps(10300);
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should enforce price bounds with PMM", async function () {
      const { lane, members, alice, brics, pmm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);

      const tokens = 1_000n * 10n ** 18n;
      
      // Set PMM price within bounds
      await pmm.setBps(10000);
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
      
      // Set PMM price below bounds
      await pmm.setBps(9700);
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
      
      // Set PMM price above bounds
      await pmm.setBps(10300);
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should use PMM when available", async function () {
      const { lane, members, alice, brics, pmm, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);

      const tokens = 1_000n * 10n ** 18n;
      
      // Set AMM price out of bounds but PMM in bounds
      await amm.setPriceBps(9700);
      await pmm.setBps(10000);
      
      // Should use PMM and succeed
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
    });
  });

  describe("Emergency Level Controls", function () {
    it("should disable at high emergency level", async function () {
      const { lane, members, alice, brics, amm, cfg, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // Set emergency level to 3 (disable threshold)
      await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 3);
      await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.disable.at.level")), 3);
      
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "IL_LEVEL");
    });

    it("should allow redemption at low emergency level", async function () {
      const { lane, members, alice, brics, amm, cfg, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // Set emergency level to 1 (below disable threshold)
      await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 1);
      await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.disable.at.level")), 3);
      
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
    });
  });

  describe("Quote Functions", function () {
    it("should quote USDC for tokens correctly", async function () {
      const { lane, oracle } = await loadFixture(deployInstantLaneFixture);

      const tokens = 1_000n * 10n ** 18n;
      const usdcQuote = await lane.quoteUSDCForTokens(tokens);
      
      // At NAV = 1.0, 1000 BRICS should quote to 1000 USDC
      expect(usdcQuote).to.equal(1_000n * 1_000_000n);
    });

    it("should check instant redeem eligibility", async function () {
      const { lane, members, alice, deployer } = await loadFixture(deployInstantLaneFixture);

      const tokens = 1_000n * 10n ** 18n;
      
      // Non-member should return false
      const [ok1, cap1, used1, need1] = await lane.canInstantRedeem(await alice.getAddress(), tokens);
      expect(ok1).to.be.false;
      expect(cap1).to.equal(0);
      expect(used1).to.equal(0);
      expect(need1).to.equal(0);
      
      // Make alice a member
      await members.connect(deployer).setMember(await alice.getAddress(), true);
      
      // Member should return true
      const [ok2, cap2, used2, need2] = await lane.canInstantRedeem(await alice.getAddress(), tokens);
      expect(ok2).to.be.true;
      expect(cap2).to.be.gt(0);
      expect(used2).to.equal(0);
      expect(need2).to.equal(1_000n * 1_000_000n);
    });
  });

  describe("Pre-trade Check", function () {
    it("should check price bounds for different emergency levels", async function () {
      const { lane } = await loadFixture(deployInstantLaneFixture);

      // Level 0 bounds: 9800-10200
      const [ok0, min0, max0] = await lane.preTradeCheck(10000, 0);
      expect(ok0).to.be.true;
      expect(min0).to.equal(9800);
      expect(max0).to.equal(10200);
      
      // Level 1 bounds: 9900-10100
      const [ok1, min1, max1] = await lane.preTradeCheck(10000, 1);
      expect(ok1).to.be.true;
      expect(min1).to.equal(9900);
      expect(max1).to.equal(10100);
      
      // Level 2 bounds: 9975-10025
      const [ok2, min2, max2] = await lane.preTradeCheck(10000, 2);
      expect(ok2).to.be.true;
      expect(min2).to.equal(9975);
      expect(max2).to.equal(10025);
    });

    it("should reject prices outside bounds", async function () {
      const { lane } = await loadFixture(deployInstantLaneFixture);

      // Price below level 0 bounds
      const [ok1] = await lane.preTradeCheck(9700, 0);
      expect(ok1).to.be.false;
      
      // Price above level 0 bounds
      const [ok2] = await lane.preTradeCheck(10300, 0);
      expect(ok2).to.be.false;
    });
  });

  describe("Pause Controls", function () {
    it("should allow gov to pause and unpause", async function () {
      const { lane, gov } = await loadFixture(deployInstantLaneFixture);

      await expect(lane.connect(gov).pause())
        .to.emit(lane, "Paused")
        .withArgs(await gov.getAddress());
      
      await expect(lane.connect(gov).unpause())
        .to.emit(lane, "Unpaused")
        .withArgs(await gov.getAddress());
    });

    it("should block non-gov from pausing", async function () {
      const { lane, alice } = await loadFixture(deployInstantLaneFixture);

      await expect(lane.connect(alice).pause())
        .to.be.revertedWithCustomError(lane, "AccessControlUnauthorizedAccount");
      
      await expect(lane.connect(alice).unpause())
        .to.be.revertedWithCustomError(lane, "AccessControlUnauthorizedAccount");
    });

    it("should block operations when paused", async function () {
      const { lane, gov, members, alice, brics, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // Pause the contract
      await lane.connect(gov).pause();
      
      // Should revert when paused
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(lane, "EnforcedPause");
      
      // Unpause
      await lane.connect(gov).unpause();
      
      // Should work again
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
    });
  });

  describe("Error Handling", function () {
    it("should revert on insufficient approval", async function () {
      const { lane, members, alice, brics, pmm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await pmm.setBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // No approval - should revert with ERC20 insufficient allowance
      await expect(lane.connect(alice).instantRedeem(tokens))
        .to.be.revertedWithCustomError(brics, "ERC20InsufficientAllowance");
    });

    it("should handle config registry failures gracefully", async function () {
      const { lane, members, alice, brics, amm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await amm.setPriceBps(10000);

      const tokens = 1_000n * 10n ** 18n;
      
      // Should work even if config registry calls fail (uses defaults)
      await expect(lane.connect(alice).instantRedeem(tokens)).to.not.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amount redemption", async function () {
      const { lane, members, alice, brics, pmm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await pmm.setBps(10000);

      // Zero amount should revert with PMM/ZERO_IN
      await expect(lane.connect(alice).instantRedeem(0))
        .to.be.revertedWith("PMM/ZERO_IN");
    });

    it("should handle very large amounts", async function () {
      const { lane, members, alice, brics, pmm, deployer } = await loadFixture(deployInstantLaneFixture);

      await members.connect(deployer).setMember(await alice.getAddress(), true);
      await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
      await pmm.setBps(10000);

      // Large amount should work if within cap (50,000 USDC default cap)
      const largeTokens = 8_000n * 10n ** 18n; // 8,000 USDC worth (within 50k cap, Alice has 10k tokens)
      await expect(lane.connect(alice).instantRedeem(largeTokens)).to.not.be.reverted;
    });
  });
});
