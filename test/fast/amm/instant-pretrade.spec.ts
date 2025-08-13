import { expect } from "chai";
import { ethers } from "hardhat";
import { fundUSDC } from "../../utils/fundUSDC";

describe("InstantLane Pre-Trade Check", () => {
  let instantLane: any;
  let usdc: any;
  let brics: any;
  let oracle: any;
  let memberRegistry: any;
  let amm: any;
  let configRegistry: any;
  let deployer: any;
  let member: any;

  beforeEach(async () => {
    [deployer, member] = await ethers.getSigners();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    brics = await MockBRICSToken.deploy();
    await brics.waitForDeployment();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    oracle = await MockNAVOracle.deploy();
    await oracle.waitForDeployment();

    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    memberRegistry = await MockMemberRegistry.deploy();
    await memberRegistry.waitForDeployment();

    const MockAMM = await ethers.getContractFactory("MockAMM");
    amm = await MockAMM.deploy(usdc);
    await amm.waitForDeployment();

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(await deployer.getAddress());
    await configRegistry.waitForDeployment();

    // Deploy InstantLane
    const InstantLane = await ethers.getContractFactory("InstantLane");
    instantLane = await InstantLane.deploy(
      brics,
      usdc,
      oracle,
      memberRegistry,
      amm,
      configRegistry,
      ethers.ZeroAddress // No PMM
    );
    await instantLane.waitForDeployment();

    // Fund participants
    await fundUSDC(usdc, [instantLane, amm], { amount: 2_000_000n * 10n ** 6n });

    // Register member
    await memberRegistry.connect(deployer).setMember(await member.getAddress(), true);
  });

  it("should pass pre-trade check for level 0 (normal) with valid price", async () => {
    // Level 0 bounds: 9800-10200 bps
    const validPrice = 10000; // 100% - within bounds
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(validPrice, 0);
    
    expect(ok).to.be.true;
    expect(minBps).to.equal(9800);
    expect(maxBps).to.equal(10200);
  });

  it("should fail pre-trade check for level 0 with price below bounds", async () => {
    // Level 0 bounds: 9800-10200 bps
    const lowPrice = 9700; // 97% - below minimum
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(lowPrice, 0);
    
    expect(ok).to.be.false;
    expect(minBps).to.equal(9800);
    expect(maxBps).to.equal(10200);
  });

  it("should fail pre-trade check for level 0 with price above bounds", async () => {
    // Level 0 bounds: 9800-10200 bps
    const highPrice = 10300; // 103% - above maximum
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(highPrice, 0);
    
    expect(ok).to.be.false;
    expect(minBps).to.equal(9800);
    expect(maxBps).to.equal(10200);
  });

  it("should pass pre-trade check for level 1 (amber) with valid price", async () => {
    // Level 1 bounds: 9900-10100 bps
    const validPrice = 10000; // 100% - within bounds
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(validPrice, 1);
    
    expect(ok).to.be.true;
    expect(minBps).to.equal(9900);
    expect(maxBps).to.equal(10100);
  });

  it("should fail pre-trade check for level 1 with price outside bounds", async () => {
    // Level 1 bounds: 9900-10100 bps
    const invalidPrice = 10200; // 102% - above maximum
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(invalidPrice, 1);
    
    expect(ok).to.be.false;
    expect(minBps).to.equal(9900);
    expect(maxBps).to.equal(10100);
  });

  it("should pass pre-trade check for level 2 (red) with valid price", async () => {
    // Level 2 bounds: 9975-10025 bps
    const validPrice = 10000; // 100% - within bounds
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(validPrice, 2);
    
    expect(ok).to.be.true;
    expect(minBps).to.equal(9975);
    expect(maxBps).to.equal(10025);
  });

  it("should fail pre-trade check for level 2 with price outside narrow bounds", async () => {
    // Level 2 bounds: 9975-10025 bps
    const invalidPrice = 10050; // 100.5% - above maximum
    
    const [ok, minBps, maxBps] = await instantLane.preTradeCheck(invalidPrice, 2);
    
    expect(ok).to.be.false;
    expect(minBps).to.equal(9975);
    expect(maxBps).to.equal(10025);
  });

  it("should handle edge cases at boundary values", async () => {
    // Level 0 bounds: 9800-10200 bps
    
    // Test minimum bound
    const [okMin, minBps, maxBps] = await instantLane.preTradeCheck(9800, 0);
    expect(okMin).to.be.true;
    
    // Test maximum bound
    const [okMax] = await instantLane.preTradeCheck(10200, 0);
    expect(okMax).to.be.true;
    
    // Test just below minimum
    const [okBelow] = await instantLane.preTradeCheck(9799, 0);
    expect(okBelow).to.be.false;
    
    // Test just above maximum
    const [okAbove] = await instantLane.preTradeCheck(10201, 0);
    expect(okAbove).to.be.false;
  });

  it("should work with different emergency levels", async () => {
    const testPrice = 10000; // 100%
    
    // Level 0: 9800-10200
    const [ok0, min0, max0] = await instantLane.preTradeCheck(testPrice, 0);
    expect(ok0).to.be.true;
    expect(min0).to.equal(9800);
    expect(max0).to.equal(10200);
    
    // Level 1: 9900-10100
    const [ok1, min1, max1] = await instantLane.preTradeCheck(testPrice, 1);
    expect(ok1).to.be.true;
    expect(min1).to.equal(9900);
    expect(max1).to.equal(10100);
    
    // Level 2: 9975-10025
    const [ok2, min2, max2] = await instantLane.preTradeCheck(testPrice, 2);
    expect(ok2).to.be.true;
    expect(min2).to.equal(9975);
    expect(max2).to.equal(10025);
  });
});

