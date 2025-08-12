import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("InstantLane - Level-Aware Price Bounds", () => {
  let usdc: Contract;
  let brics: Contract;
  let oracle: Contract;
  let members: Contract;
  let amm: Contract;
  let pmm: Contract;
  let config: Contract;
  let lane: Contract;
  let laneWithPmm: Contract;

  let owner: Signer;
  let member: Signer;
  let memberAddr: string;
  let ownerAddr: string;

  const RAY = ethers.parseUnits("1", 27);
  const TOKENS_18 = ethers.parseUnits("1000", 18); // 1000 BRICS tokens
  const USDC_6 = ethers.parseUnits("1000", 6); // 1000 USDC

  beforeEach(async () => {
    [owner, member] = await ethers.getSigners();
    memberAddr = await member.getAddress();
    ownerAddr = await owner.getAddress();

    // Deploy mocks
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    brics = await MockBRICSToken.deploy();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    oracle = await MockNAVOracle.deploy();
    await oracle.setLatestNAVRay(RAY); // NAV = 1.0

    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    members = await MockMemberRegistry.deploy();
    await members.setMember(memberAddr, true);

    const MockAMM = await ethers.getContractFactory("MockAMM");
    amm = await MockAMM.deploy(usdc);

    const MockPMM = await ethers.getContractFactory("MockPMM");
    pmm = await MockPMM.deploy(usdc);

    const MockConfigRegistry = await ethers.getContractFactory("MockConfigRegistry");
    config = await MockConfigRegistry.deploy();

    // Deploy InstantLane without PMM
    const InstantLane = await ethers.getContractFactory("InstantLane");
    lane = await InstantLane.deploy(brics, usdc, oracle, members, amm, config, ethers.ZeroAddress);

    // Deploy InstantLane with PMM
    laneWithPmm = await InstantLane.deploy(brics, usdc, oracle, members, amm, config, pmm);

    // Setup: Fund lane with USDC buffer, mint BRICS to member
    await usdc.mint(lane, USDC_6 * 100n); // 100k USDC buffer (enough for max price)
    await usdc.mint(laneWithPmm, USDC_6 * 100n); // 100k USDC buffer (enough for max price)
    await brics.mint(memberAddr, TOKENS_18 * 10n); // 10k BRICS tokens

    // Approve lane to spend member's BRICS
    await brics.connect(member).approve(lane, TOKENS_18 * 10n);
    await brics.connect(member).approve(laneWithPmm, TOKENS_18 * 10n);
  });

  describe("Emergency Level 0 (Normal)", () => {
    beforeEach(async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 0);
    });

    it("should allow swaps within L0 bounds [9800..10200]", async () => {
      // Set AMM price to 10000 (within bounds)
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should revert when price below L0 min bound (9800)", async () => {
      await amm.setPriceBps(9799);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should revert when price above L0 max bound (10200)", async () => {
      await amm.setPriceBps(10201);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should allow exact min bound (9800)", async () => {
      await amm.setPriceBps(9800);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should allow exact max bound (10200)", async () => {
      await amm.setPriceBps(10200);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });
  });

  describe("Emergency Level 1 (Amber)", () => {
    beforeEach(async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 1);
    });

    it("should allow swaps within L1 bounds [9900..10100]", async () => {
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should revert when price below L1 min bound (9900)", async () => {
      await amm.setPriceBps(9899);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should revert when price above L1 max bound (10100)", async () => {
      await amm.setPriceBps(10101);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should allow exact L1 min bound (9900)", async () => {
      await amm.setPriceBps(9900);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should allow exact L1 max bound (10100)", async () => {
      await amm.setPriceBps(10100);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });
  });

  describe("Emergency Level 2 (Red)", () => {
    beforeEach(async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 2);
    });

    it("should allow swaps within L2 bounds [9975..10025]", async () => {
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should revert when price below L2 min bound (9975)", async () => {
      await amm.setPriceBps(9974);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should revert when price above L2 max bound (10025)", async () => {
      await amm.setPriceBps(10026);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_BOUNDS");
    });

    it("should allow exact L2 min bound (9975)", async () => {
      await amm.setPriceBps(9975);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should allow exact L2 max bound (10025)", async () => {
      await amm.setPriceBps(10025);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });
  });

  describe("Emergency Level 3+ (Disabled)", () => {
    beforeEach(async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 3);
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.disable.at.level")), 3);
    });

    it("should revert IL_LEVEL when emergency level >= disable level", async () => {
      await amm.setPriceBps(10000);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_LEVEL");
    });

    it("should revert IL_LEVEL for level 4", async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 4);
      await amm.setPriceBps(10000);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_LEVEL");
    });

    it("should work when level < disable level", async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 2);
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });
  });

  describe("Configuration Defaults", () => {
    it("should use defaults when config keys are unset", async () => {
      // No config set - should use defaults (L0 bounds: 9800-10200)
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should use defaults when config registry is address(0)", async () => {
      // Deploy lane with no config registry
      const InstantLane = await ethers.getContractFactory("InstantLane");
      const laneNoConfig = await InstantLane.deploy(brics, usdc, oracle, members, amm, ethers.ZeroAddress, ethers.ZeroAddress);
      
      await usdc.mint(laneNoConfig, USDC_6 * 10n);
      await brics.connect(member).approve(laneNoConfig, TOKENS_18 * 10n);
      
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await laneNoConfig.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });
  });

  describe("PMM Routing", () => {
    beforeEach(async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 0);
    });

    it("should use PMM when available and price within bounds", async () => {
      await pmm.setBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await laneWithPmm.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should revert IL_BOUNDS when PMM price out of bounds", async () => {
      await pmm.setBps(9700); // Below L0 min bound (9800)
      
      await expect(laneWithPmm.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(laneWithPmm, "IL_BOUNDS");
    });

    it("should emit PMM Swapped event", async () => {
      await pmm.setBps(10000);
      
      await expect(laneWithPmm.connect(member).instantRedeem(TOKENS_18))
        .to.emit(pmm, "Swapped");
    });

    it("should use AMM when PMM is address(0)", async () => {
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should handle PMM price change between quote and execution", async () => {
      await pmm.setBps(10000);
      
      // First call should work
      await laneWithPmm.connect(member).instantRedeem(TOKENS_18);
      
      // Change PMM price before second call
      await pmm.setBps(10100);
      
      // Should still work as long as within bounds
      await laneWithPmm.connect(member).instantRedeem(TOKENS_18);
    });
  });

  describe("Backwards Compatibility", () => {
    it("should work with zero-address PMM (backwards compatible)", async () => {
      await amm.setPriceBps(10000);
      
      const beforeBalance = await usdc.balanceOf(memberAddr);
      await lane.connect(member).instantRedeem(TOKENS_18);
      const afterBalance = await usdc.balanceOf(memberAddr);
      
      expect(afterBalance - beforeBalance).to.be.gt(0);
    });

    it("should maintain existing member gating", async () => {
      await members.setMember(memberAddr, false);
      await amm.setPriceBps(10000);
      
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_NOT_MEMBER");
    });

    it("should maintain existing daily cap enforcement", async () => {
      await config.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.dailyCap.usdc")), USDC_6);
      await amm.setPriceBps(10000);
      
      // First redemption should work
      await lane.connect(member).instantRedeem(TOKENS_18);
      
      // Second redemption should exceed daily cap
      await expect(lane.connect(member).instantRedeem(TOKENS_18))
        .to.be.revertedWithCustomError(lane, "IL_CAP_EXCEEDED");
    });
  });
});
