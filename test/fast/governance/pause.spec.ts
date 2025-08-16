import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { setNavCompat } from "../../utils/nav-helpers";

describe("Pause Functionality", () => {
  let gov: Signer;
  let user: Signer;
  let instantLane: Contract;
  let bricsToken: Contract;
  let usdc: Contract;
  let navOracle: Contract;
  let memberRegistry: Contract;
  let amm: Contract;
  let configRegistry: Contract;

  beforeEach(async () => {
    [gov, user] = await ethers.getSigners();
    
    // Deploy contracts
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(await gov.getAddress());
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    
    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    bricsToken = await MockBRICSToken.deploy();
    
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy();
    await setNavCompat(navOracle, ethers.parseUnits("1", 27)); // 1.0 RAY
    
    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    memberRegistry = await MockMemberRegistry.deploy();
    await memberRegistry.setMember(await user.getAddress(), true);
    
    const MockAMM = await ethers.getContractFactory("MockAMM");
    amm = await MockAMM.deploy(usdc, bricsToken);
    
    const InstantLane = await ethers.getContractFactory("InstantLane");
    instantLane = await InstantLane.deploy(
      bricsToken,
      usdc,
      navOracle,
      memberRegistry,
      amm,
      configRegistry,
      ethers.ZeroAddress, // no PMM
      await gov.getAddress()
    );
    
    // Fund contracts and user
    await bricsToken.mint(await user.getAddress(), ethers.parseUnits("1000", 18));
    await usdc.mint(instantLane.getAddress(), ethers.parseUnits("100000", 6));
    await usdc.mint(amm.getAddress(), ethers.parseUnits("100000", 6));
    
    // Approve InstantLane to spend user's BRICS
    await bricsToken.connect(user).approve(instantLane.getAddress(), ethers.MaxUint256);
  });

  describe("InstantLane Pause", () => {
    it("should allow instantRedeem when unpaused", async () => {
      // Should succeed when unpaused
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("100", 18)))
        .to.not.be.reverted;
    });

    it("should revert instantRedeem when paused", async () => {
      // Pause the contract
      await instantLane.connect(gov).pause();
      
      // Should revert with EnforcedPause
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("100", 18)))
        .to.be.revertedWithCustomError(instantLane, "EnforcedPause");
    });

    it("should allow instantRedeem when unpaused again", async () => {
      // Pause the contract
      await instantLane.connect(gov).pause();
      
      // Unpause the contract
      await instantLane.connect(gov).unpause();
      
      // Should succeed when unpaused again
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("100", 18)))
        .to.not.be.reverted;
    });

    it("should revert instantRedeemFor when paused", async () => {
      // Pause the contract
      await instantLane.connect(gov).pause();
      
      // Should revert with EnforcedPause
      await expect(instantLane.connect(user).instantRedeemFor(await user.getAddress(), ethers.parseUnits("100", 18)))
        .to.be.revertedWithCustomError(instantLane, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      // Pause the contract
      await instantLane.connect(gov).pause();
      
      // View functions should still work
      await expect(instantLane.preTradeCheck(10000, 0))
        .to.not.be.reverted;
      
      await expect(instantLane.dailyUsed(await user.getAddress()))
        .to.not.be.reverted;
    });

    it("should emit Paused event", async () => {
      await expect(instantLane.connect(gov).pause())
        .to.emit(instantLane, "Paused")
        .withArgs(await gov.getAddress());
    });

    it("should emit Unpaused event", async () => {
      await instantLane.connect(gov).pause();
      
      await expect(instantLane.connect(gov).unpause())
        .to.emit(instantLane, "Unpaused")
        .withArgs(await gov.getAddress());
    });

    it("SMOKE: should toggle pause/resume and assert revert on paused path", async () => {
      // Initial state: should work
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("50", 18)))
        .to.not.be.reverted;
      
      // Pause: should revert
      await instantLane.connect(gov).pause();
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("50", 18)))
        .to.be.revertedWithCustomError(instantLane, "EnforcedPause");
      
      // Resume: should work again
      await instantLane.connect(gov).unpause();
      await expect(instantLane.connect(user).instantRedeem(ethers.parseUnits("50", 18)))
        .to.not.be.reverted;
    });
  });
});

