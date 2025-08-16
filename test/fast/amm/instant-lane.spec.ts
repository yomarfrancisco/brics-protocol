import { expect } from "chai";
import { ethers } from "hardhat";
import { getNavRayCompat } from "../../utils/nav-helpers";

describe("InstantLane - member gating, daily cap, AMM bounds", function () {
  it("enforces member gating, cap, and price bounds; performs instant redeem", async function () {
    const [deployer, alice] = await ethers.getSigners();

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
    await members.connect(deployer).setMember(await alice.getAddress(), true);

    // NAV oracle mock with latestNAVRay()
    const Oracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
    // 1.00 NAV in RAY
    await oracle.setLatestNAVRay(ethers.toBigInt("1000000000000000000000000000")); // 1e27

    const AMM = await ethers.getContractFactory("MockAMM");
    const amm = await AMM.deploy(await usdc.getAddress());
    await amm.waitForDeployment();
    // Set par price
    await amm.setPriceBps(10000);

    // Config registry mock (optional)
    const Cfg = await ethers.getContractFactory("MockConfigRegistry");
    const cfg = await Cfg.deploy();
    await cfg.waitForDeployment();
    // daily cap = 50k USDC
    await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.dailyCap.usdc")), 50_000n * 1_000_000n);
    // bounds 98%..102%
    await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.min.bps")), 9800);
    await cfg.setUint(ethers.keccak256(ethers.toUtf8Bytes("instant.price.max.bps")), 10200);

    // Fund lane with USDC buffer and Alice with BRICS
    await usdc.mint(await deployer.getAddress(), 1_000_000n * 1_000_000n);
    await usdc.transfer(await (await deployer.getAddress()), 0); // noop

    const Lane = await ethers.getContractFactory("InstantLane");
    const lane = await Lane.deploy(
      await brics.getAddress(),
      await usdc.getAddress(),
      await oracle.getAddress(),
      await members.getAddress(),
      await amm.getAddress(),
      await cfg.getAddress(),
      ethers.ZeroAddress, // PMM parameter (optional, can be address(0))
      await deployer.getAddress() // gov parameter
    );
    await lane.waitForDeployment();

    // Move USDC buffer to lane so it can feed AMM
    await usdc.transfer(await lane.getAddress(), 100_000n * 1_000_000n);

    // Mint BRICS to Alice (18 decimals)
    await brics.mint(await alice.getAddress(), 10_000n * 10n ** 18n);
    // Approve lane to pull BRICS
    await brics.connect(alice).approve(await lane.getAddress(), ethers.MaxUint256);
    // Approve AMM to pull USDC from lane is done inside contract via approve()
    // but token requires allowance from lane -> we already call approve() in contract before swap

    // Check canInstantRedeem
    const tokens = 1_000n * 10n ** 18n; // 1,000 BRICS ~ 1,000 USDC at NAV 1
    const [ok1, cap, used, need] = await lane.canInstantRedeem(await alice.getAddress(), tokens);
    expect(ok1).to.eq(true);
    expect(cap).to.eq(50_000n * 1_000_000n);
    expect(used).to.eq(0);
    expect(need).to.eq(1_000n * 1_000_000n);

    // Perform redeem
    const before = await usdc.balanceOf(await alice.getAddress());
    await lane.connect(alice).instantRedeem(tokens);
    const after = await usdc.balanceOf(await alice.getAddress());
    expect(after - before).to.eq(1_000n * 1_000_000n);

    // Exhaust cap by large redemption, expect revert when exceeding
    // Set AMM to within bounds still
    await amm.setPriceBps(9950);
    // try redeem remaining cap + 1 USDC
    const remaining = (await lane.canInstantRedeem(await alice.getAddress(), 0)).at(1)!; // cap
    const [, , usedNow] = await lane.canInstantRedeem(await alice.getAddress(), 0);
    const rem = cap - usedNow;
    // ask a bit over remaining (rem + 1 USDC worth)
    const overTokens = (rem + 1n) * 10n ** 18n / 1_000_000n; // approximate inverse at NAV=1
    await expect(lane.connect(alice).instantRedeem(overTokens)).to.be.revertedWithCustomError(lane, "IL_CAP_EXCEEDED");

    // Price out of bounds should revert
    await amm.setPriceBps(9700); // below min 9800
    await expect(lane.connect(alice).instantRedeem(10n * 10n ** 18n)).to.be.revertedWithCustomError(lane, "IL_BOUNDS");
  });

  it("blocks non-members", async function () {
    const [deployer, bob] = await ethers.getSigners();
    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    
    // Mint USDC to deployer first
    await usdc.mint(await deployer.getAddress(), 1_000_000n * 1_000_000n);
    
    const BRICS = await ethers.getContractFactory("MockBRICSToken");
    const brics = await BRICS.deploy();
    await brics.waitForDeployment();
    const Member = await ethers.getContractFactory("MockMemberRegistry");
    const members = await Member.deploy();
    await members.waitForDeployment();
    const Oracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setLatestNAVRay(ethers.toBigInt("1000000000000000000000000000"));
    const AMM = await ethers.getContractFactory("MockAMM");
    const amm = await AMM.deploy(await usdc.getAddress());
    await amm.waitForDeployment();
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
      ethers.ZeroAddress, // PMM parameter (optional, can be address(0))
      await deployer.getAddress() // gov parameter
    );
    await lane.waitForDeployment();
    await usdc.transfer(await lane.getAddress(), 10_000n * 1_000_000n);
    await brics.mint(await bob.getAddress(), 100n * 10n ** 18n);
    await brics.connect(bob).approve(await lane.getAddress(), ethers.MaxUint256);
    await expect(lane.connect(bob).instantRedeem(10n * 10n ** 18n)).to.be.revertedWithCustomError(lane, "IL_NOT_MEMBER");
  });
});
