import { expect } from "chai";
import { ethers } from "hardhat";

describe("NASASAGateway: instant lane integration", () => {
  let gateway: any;
  let instantLane: any;
  let usdc: any;
  let brics: any;
  let navOracle: any;
  let members: any;
  let amm: any;
  let configRegistry: any;
  let owner: any;
  let user: any;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    // Deploy all mocks
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    brics = await MockBRICSToken.deploy();
    await brics.waitForDeployment();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy();
    await navOracle.waitForDeployment();
    await navOracle.setLatestNAVRay(ethers.toBigInt("1000000000000000000000000000")); // 1e27

    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    members = await MockMemberRegistry.deploy();
    await members.waitForDeployment();

    const MockAMM = await ethers.getContractFactory("MockAMM");
    amm = await MockAMM.deploy(await usdc.getAddress());
    await amm.waitForDeployment();
    await amm.setPriceBps(10000); // par price

    const MockConfigRegistry = await ethers.getContractFactory("MockConfigRegistry");
    configRegistry = await MockConfigRegistry.deploy();
    await configRegistry.waitForDeployment();
    await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.dailyCap.usdc")), 50_000n * 1_000_000n);
    await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.min.bps")), 9800);
    await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.max.bps")), 10200);

    // Deploy InstantLane
    const InstantLane = await ethers.getContractFactory("InstantLane");
    instantLane = await InstantLane.deploy(
      await brics.getAddress(),
      await usdc.getAddress(),
      await navOracle.getAddress(),
      await members.getAddress(),
      await amm.getAddress(),
      await configRegistry.getAddress(),
      ethers.ZeroAddress, // PMM parameter (optional, can be address(0))
      await owner.getAddress() // gov parameter
    );
    await instantLane.waitForDeployment();

    // Deploy NASASAGateway (with minimal dependencies for instant lane testing)
    const MockRedemptionClaim = await ethers.getContractFactory("MockRedemptionClaim");
    const redemptionClaim = await MockRedemptionClaim.deploy();
    await redemptionClaim.waitForDeployment();

    const MockAccessController = await ethers.getContractFactory("MockAccessController");
    const accessController = await MockAccessController.deploy();
    await accessController.waitForDeployment();

    const RedemptionQueue = await ethers.getContractFactory("RedemptionQueue");
    const redemptionQueue = await RedemptionQueue.deploy(await accessController.getAddress(), await configRegistry.getAddress());
    await redemptionQueue.waitForDeployment();

    const NASASAGateway = await ethers.getContractFactory("NASASAGateway");
    gateway = await NASASAGateway.deploy(
      await usdc.getAddress(),
      await brics.getAddress(),
      await redemptionClaim.getAddress(),
      await redemptionQueue.getAddress(),
      await navOracle.getAddress(),
      await configRegistry.getAddress()
    );
    await gateway.waitForDeployment();

    // Grant admin role to gateway
    await accessController.grantRole(await redemptionQueue.ADMIN_ROLE(), await gateway.getAddress());

    // Fund instant lane with USDC buffer
    await usdc.mint(await owner.getAddress(), 1_000_000n * 1_000_000n);
    await usdc.transfer(await instantLane.getAddress(), 100_000n * 1_000_000n);

    // Set up user as member
    await members.connect(owner).setMember(await user.getAddress(), true);

    // Mint BRICS to user and approve both gateway and instant lane
    await brics.mint(await user.getAddress(), 100_000n * 10n ** 18n); // 100k tokens
    await brics.connect(user).approve(await gateway.getAddress(), ethers.MaxUint256);
    await brics.connect(user).approve(await instantLane.getAddress(), ethers.MaxUint256);
  });

  describe("Instant lane setup", () => {
    it("allows setting instant lane", async () => {
      await gateway.connect(owner).setInstantLane(await instantLane.getAddress());
      expect(await gateway.instantLane()).to.equal(await instantLane.getAddress());
    });

    it("emits InstantLaneSet event", async () => {
      await expect(gateway.connect(owner).setInstantLane(await instantLane.getAddress()))
        .to.emit(gateway, "InstantLaneSet")
        .withArgs(await instantLane.getAddress());
    });
  });

  describe("Happy path", () => {
    beforeEach(async () => {
      await gateway.connect(owner).setInstantLane(await instantLane.getAddress());
    });

    it("performs instant redemption through gateway", async () => {
      const tokens = 1_000n * 10n ** 18n; // 1,000 BRICS
      
      // Check canInstantRedeem through gateway
      const [ok, cap, used, need] = await gateway.canInstantRedeem(await user.getAddress(), tokens);
      expect(ok).to.be.true;
      expect(cap).to.equal(50_000n * 1_000_000n);
      expect(used).to.equal(0);
      expect(need).to.equal(1_000n * 1_000_000n);

      // Perform redemption through gateway
      const before = await usdc.balanceOf(await user.getAddress());
      await gateway.connect(user).redeemInstant(tokens);
      const after = await usdc.balanceOf(await user.getAddress());
      expect(after - before).to.equal(1_000n * 1_000_000n);

      // Verify daily cap is tracked
      const [okAfter, , usedAfter] = await gateway.canInstantRedeem(await user.getAddress(), 0);
      expect(usedAfter).to.equal(1_000n * 1_000_000n);
    });
  });

  describe("Reverts", () => {
    it("reverts redeemInstant before setInstantLane", async () => {
      await expect(gateway.connect(user).redeemInstant(1000n * 10n ** 18n))
        .to.be.revertedWith("GW/INSTANT_UNSET");
    });

    it("reverts canInstantRedeem before setInstantLane", async () => {
      await expect(gateway.canInstantRedeem(await user.getAddress(), 1000n * 10n ** 18n))
        .to.be.revertedWith("GW/INSTANT_UNSET");
    });

    it("bubbles up non-member error from lane", async () => {
      await gateway.connect(owner).setInstantLane(await instantLane.getAddress());
      
      // Remove user from members
      await members.connect(owner).setMember(await user.getAddress(), false);
      
      await expect(gateway.connect(user).redeemInstant(1000n * 10n ** 18n))
        .to.be.revertedWithCustomError(instantLane, "IL_NOT_MEMBER");
    });
  });

  describe("Bounds and cap passthrough", () => {
    beforeEach(async () => {
      await gateway.connect(owner).setInstantLane(await instantLane.getAddress());
    });

    it("bubbles up bounds error from lane", async () => {
      // Set AMM price out of bounds
      await amm.setPriceBps(9700); // below min 9800
      
      await expect(gateway.connect(user).redeemInstant(10n * 10n ** 18n))
        .to.be.revertedWithCustomError(instantLane, "IL_BOUNDS");
    });

    it("bubbles up cap exceeded error from lane", async () => {
      // First, do a small redemption to use some of the daily cap
      await gateway.connect(user).redeemInstant(1_000n * 10n ** 18n);
      
      // Now try to redeem more than the remaining cap
      const remainingCap = 49_000n * 1_000_000n; // 49k USDC remaining
      const overCapTokens = (remainingCap + 1_000_000n) * 10n ** 18n / 1_000_000n; // Slightly over cap
      
      await expect(gateway.connect(user).redeemInstant(overCapTokens))
        .to.be.revertedWithCustomError(instantLane, "IL_CAP_EXCEEDED");
    });
  });
});
