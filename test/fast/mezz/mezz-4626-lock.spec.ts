import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MezzVault4626: lock functionality", () => {
  let vault: any;
  let mezzAsset: any;
  let configRegistry: any;
  let owner: any;
  let gov: any;
  let emergency: any;
  let user1: any;
  let user2: any;

  const LOCK_DURATION = 5 * 365 * 24 * 60 * 60; // 5 years
  const GRACE_WINDOW = 30 * 24 * 60 * 60; // 30 days

  beforeEach(async () => {
    [owner, gov, emergency, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockConfigRegistry = await ethers.getContractFactory("MockConfigRegistry");
    configRegistry = await MockConfigRegistry.deploy();
    await configRegistry.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockBRICSToken");
    mezzAsset = await MockERC20.deploy();
    await mezzAsset.waitForDeployment();

    // Deploy MezzVault4626
    const MezzVault4626 = await ethers.getContractFactory("MezzVault4626");
    vault = await MezzVault4626.deploy(
      await mezzAsset.getAddress(),
      "Mezzanine Vault",
      "mMEZZ",
      await configRegistry.getAddress()
    );
    await vault.waitForDeployment();

    // Grant roles
    await vault.grantRole(await vault.GOV_ROLE(), await gov.getAddress());
    await vault.grantRole(await vault.EMERGENCY_ROLE(), await emergency.getAddress());

    // Fund users with mezzanine assets
    await mezzAsset.mint(await user1.getAddress(), ethers.parseUnits("1000", 18));
    await mezzAsset.mint(await user2.getAddress(), ethers.parseUnits("1000", 18));

    // Approve vault to spend user assets
    await mezzAsset.connect(user1).approve(await vault.getAddress(), ethers.MaxUint256);
    await mezzAsset.connect(user2).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("Deposit sets/extends lock", () => {
    it("first deposit sets minUnlockTs to now + 5y", async () => {
      const depositAmount = ethers.parseUnits("100", 18);
      const currentTime = await time.latest();
      
      await vault.connect(user1).deposit(depositAmount, await user1.getAddress());
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(unlockTs).to.be.closeTo(currentTime + LOCK_DURATION, 2);
    });

    it("second deposit extends lock if later", async () => {
      const depositAmount = ethers.parseUnits("100", 18);
      
      // First deposit
      await vault.connect(user1).deposit(depositAmount, await user1.getAddress());
      const firstUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      
      // Advance time by 1 year
      await time.increase(365 * 24 * 60 * 60);
      
      // Second deposit
      await vault.connect(user1).deposit(depositAmount, await user1.getAddress());
      const secondUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      
      expect(secondUnlockTs).to.be.gt(firstUnlockTs);
    });

    it("second deposit does not extend lock if earlier", async () => {
      const depositAmount = ethers.parseUnits("100", 18);
      
      // First deposit
      await vault.connect(user1).deposit(depositAmount, await user1.getAddress());
      const firstUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      
      // Second deposit immediately (should not extend)
      await vault.connect(user1).deposit(depositAmount, await user1.getAddress());
      const secondUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      
      expect(secondUnlockTs).to.be.closeTo(firstUnlockTs, 1);
    });

    it("mint also sets/extends lock", async () => {
      const mintAmount = ethers.parseUnits("100", 18);
      const currentTime = await time.latest();
      
      await vault.connect(user1).mint(mintAmount, await user1.getAddress());
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(unlockTs).to.be.closeTo(currentTime + LOCK_DURATION, 2);
    });
  });

  describe("Withdraw before unlock reverts", () => {
    beforeEach(async () => {
      // Deposit to set lock
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("withdraw reverts with MV_LOCKED", async () => {
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.be.revertedWithCustomError(vault, "MV_LOCKED");
    });

    it("redeem reverts with MV_LOCKED", async () => {
      await expect(
        vault.connect(user1).redeem(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.be.revertedWithCustomError(vault, "MV_LOCKED");
    });

    it("partial withdraw still blocked pre-unlock", async () => {
      // Try to withdraw immediately after deposit (should be locked)
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.be.revertedWithCustomError(vault, "MV_LOCKED");
    });
  });

  describe("Full withdraw in grace window succeeds", () => {
    beforeEach(async () => {
      // Deposit to set lock
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("withdraw all at exactly unlock time succeeds", async () => {
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs);
      
      const balance = await vault.balanceOf(await user1.getAddress());
      await expect(
        vault.connect(user1).withdraw(balance, await user1.getAddress(), await user1.getAddress())
      ).to.not.be.reverted;
    });

    it("withdraw all within grace window resets lock to 0", async () => {
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs + BigInt(GRACE_WINDOW) - 1n); // Just before grace window ends
      
      const balance = await vault.balanceOf(await user1.getAddress());
      await vault.connect(user1).withdraw(balance, await user1.getAddress(), await user1.getAddress());
      
      const newUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(newUnlockTs).to.equal(0);
    });

    it("partial withdraw within grace window does not reset lock", async () => {
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs + BigInt(GRACE_WINDOW) - 1n);
      
      await vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress());
      
      const newUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(newUnlockTs).to.equal(unlockTs);
    });

    it("withdraw after grace window does not reset lock", async () => {
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs + BigInt(GRACE_WINDOW) + 1n); // After grace window
      
      const balance = await vault.balanceOf(await user1.getAddress());
      await vault.connect(user1).withdraw(balance, await user1.getAddress(), await user1.getAddress());
      
      const newUnlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(newUnlockTs).to.equal(unlockTs);
    });
  });

  describe("Emergency force unlock", () => {
    beforeEach(async () => {
      // Deposit to set lock
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("EMERGENCY_ROLE can force unlock users", async () => {
      await expect(
        vault.connect(emergency).forceUnlock([await user1.getAddress()])
      ).to.emit(vault, "ForceUnlocked").withArgs(await user1.getAddress());
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(unlockTs).to.equal(0);
    });

    it("force unlocked users can withdraw immediately", async () => {
      await vault.connect(emergency).forceUnlock([await user1.getAddress()]);
      
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.not.be.reverted;
    });

    it("non-emergency role cannot force unlock", async () => {
      await expect(
        vault.connect(user1).forceUnlock([await user2.getAddress()])
      ).to.be.revertedWith("MV/ONLY_EMERGENCY");
    });

    it("can force unlock multiple users", async () => {
      await vault.connect(user2).deposit(ethers.parseUnits("100", 18), await user2.getAddress());
      
      await vault.connect(emergency).forceUnlock([await user1.getAddress(), await user2.getAddress()]);
      
      expect(await vault.minUnlockOf(await user1.getAddress())).to.equal(0);
      expect(await vault.minUnlockOf(await user2.getAddress())).to.equal(0);
    });
  });

  describe("Pause blocks ops", () => {
    beforeEach(async () => {
      // Deposit to set lock
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("pause blocks deposit", async () => {
      await vault.connect(gov).pause();
      
      await expect(
        vault.connect(user2).deposit(ethers.parseUnits("100", 18), await user2.getAddress())
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("pause blocks withdraw", async () => {
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs);
      
      await vault.connect(gov).pause();
      
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("unpause restores functionality", async () => {
      await vault.connect(gov).pause();
      await vault.connect(gov).unpause();
      
      // Should be able to deposit again
      await expect(
        vault.connect(user2).deposit(ethers.parseUnits("100", 18), await user2.getAddress())
      ).to.not.be.reverted;
    });

    it("non-gov role cannot pause", async () => {
      await expect(
        vault.connect(user1).pause()
      ).to.be.revertedWith("MV/ONLY_GOV");
    });
  });

  describe("Config overrides", () => {
    it("respects custom lock duration from config", async () => {
      const customDuration = 10 * 24 * 60 * 60; // 10 days
      await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("mezz.lock.durationSec")), customDuration);
      
      const currentTime = await time.latest();
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      expect(unlockTs).to.be.closeTo(currentTime + customDuration, 2);
    });

    it("respects custom grace window from config", async () => {
      const customGrace = 2 * 24 * 60 * 60; // 2 days
      await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("mezz.lock.graceSec")), customGrace);
      
      // Deposit and advance to unlock time
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs);
      
      // Withdraw within custom grace window
      const balance = await vault.balanceOf(await user1.getAddress());
      await vault.connect(user1).withdraw(balance, await user1.getAddress(), await user1.getAddress());
      
      // Lock should be reset
      expect(await vault.minUnlockOf(await user1.getAddress())).to.equal(0);
    });
  });

  describe("Whitelist functionality", () => {
    beforeEach(async () => {
      // Deposit to set lock
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("whitelisted users can withdraw before unlock", async () => {
      await vault.connect(gov).setWhitelist(await user1.getAddress(), true);
      
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.not.be.reverted;
    });

    it("non-whitelisted users cannot withdraw before unlock", async () => {
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("50", 18), await user1.getAddress(), await user1.getAddress())
      ).to.be.revertedWithCustomError(vault, "MV_LOCKED");
    });

    it("gov can update whitelist", async () => {
      await expect(
        vault.connect(gov).setWhitelist(await user1.getAddress(), true)
      ).to.emit(vault, "WhitelistUpdated").withArgs(await user1.getAddress(), true);
      
      expect(await vault.whitelist(await user1.getAddress())).to.be.true;
    });

    it("non-gov cannot update whitelist", async () => {
      await expect(
        vault.connect(user1).setWhitelist(await user2.getAddress(), true)
      ).to.be.revertedWith("MV/ONLY_GOV");
    });
  });

  describe("View functions", () => {
    beforeEach(async () => {
      await vault.connect(user1).deposit(ethers.parseUnits("100", 18), await user1.getAddress());
    });

    it("isLocked returns correct status", async () => {
      expect(await vault.isLocked(await user1.getAddress())).to.be.true;
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs);
      
      expect(await vault.isLocked(await user1.getAddress())).to.be.false;
    });

    it("canWithdraw returns correct status", async () => {
      expect(await vault.canWithdraw(await user1.getAddress())).to.be.false;
      
      const unlockTs = await vault.minUnlockOf(await user1.getAddress());
      await time.increaseTo(unlockTs);
      
      expect(await vault.canWithdraw(await user1.getAddress())).to.be.true;
    });

    it("whitelisted users can withdraw regardless of lock", async () => {
      await vault.connect(gov).setWhitelist(await user1.getAddress(), true);
      
      expect(await vault.isLocked(await user1.getAddress())).to.be.false;
      expect(await vault.canWithdraw(await user1.getAddress())).to.be.true;
    });
  });

  describe("Governance functions", () => {
    it("gov can update config registry", async () => {
      const newRegistry = await user2.getAddress();
      
      await expect(
        vault.connect(gov).setConfigRegistry(newRegistry)
      ).to.emit(vault, "ConfigRegistryUpdated").withArgs(newRegistry);
      
      expect(await vault.configRegistry()).to.equal(newRegistry);
    });

    it("non-gov cannot update config registry", async () => {
      await expect(
        vault.connect(user1).setConfigRegistry(await user2.getAddress())
      ).to.be.revertedWith("MV/ONLY_GOV");
    });

    it("cannot set zero address as config registry", async () => {
      await expect(
        vault.connect(gov).setConfigRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "MV_ZERO_ADDRESS");
    });
  });
});
