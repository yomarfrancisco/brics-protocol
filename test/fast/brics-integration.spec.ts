import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { fundBRICS } from "../utils/fundBRICS";
import { fundUSDC } from "../utils/fundUSDC";

describe("BRICS Token Integration", () => {
  let bricsToken: Contract;
  let usdcToken: Contract;
  let treasury: Contract;
  let instantLane: Contract;
  let memberRegistry: Contract;
  let configRegistry: Contract;
  let mockAMM: Contract;
  let mockPMM: Contract;
  let mockOracle: Contract;
  let deployer: Signer;
  let treasuryOps: Signer;
  let whale: Signer;
  let member: Signer;

  beforeEach(async () => {
    [deployer, treasuryOps, whale, member] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();
    const treasuryOpsAddr = await treasuryOps.getAddress();
    const whaleAddr = await whale.getAddress();
    const memberAddr = await member.getAddress();

    // Deploy core contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdcToken = await MockUSDC.deploy();
    await usdcToken.waitForDeployment();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    bricsToken = await MockBRICSToken.deploy();
    await bricsToken.waitForDeployment();

    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    memberRegistry = await MockMemberRegistry.deploy();
    await memberRegistry.waitForDeployment();

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(deployerAddr);
    await configRegistry.waitForDeployment();

    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(treasuryOpsAddr, await usdcToken.getAddress(), 300); // 3% target
    await treasury.waitForDeployment();

    const MockAMM = await ethers.getContractFactory("MockAMM");
    mockAMM = await MockAMM.deploy(usdcToken);
    await mockAMM.waitForDeployment();

    const MockPMM = await ethers.getContractFactory("MockPMM");
    mockPMM = await MockPMM.deploy(usdcToken);
    await mockPMM.waitForDeployment();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    mockOracle = await MockNAVOracle.deploy();
    await mockOracle.waitForDeployment();

    const InstantLane = await ethers.getContractFactory("InstantLane");
    instantLane = await InstantLane.deploy(
      bricsToken,
      usdcToken,
      mockOracle,
      memberRegistry,
      mockAMM,
      configRegistry,
      mockPMM,
      await deployer.getAddress() // gov parameter
    );
    await instantLane.waitForDeployment();

    // Fund participants
    await fundUSDC(usdcToken, [treasury, instantLane, mockAMM, mockPMM], { 
      amount: 2_000_000n * 10n ** 6n 
    });
    
    await fundBRICS(bricsToken, [treasuryOpsAddr, whaleAddr, memberAddr], { 
      amount: 10_000_000n * 10n ** 18n 
    });

    // Register member
    await memberRegistry.connect(deployer).setMember(memberAddr, true);
  });

  it("should integrate BRICS token with InstantLane for instant redemption", async () => {
    const memberAddr = await member.getAddress();
    const treasuryOpsAddr = await treasuryOps.getAddress();
    
    // Member approves InstantLane to spend their BRICS
    const redeemAmount = ethers.parseUnits("1000", 18); // 1000 BRICS
    await bricsToken.connect(member).approve(await instantLane.getAddress(), redeemAmount);

    // Check if member can instant redeem
    const [canRedeem, capUSDC, usedUSDC, needUSDC] = await instantLane.canInstantRedeem(memberAddr, redeemAmount);
    
    console.log(`📊 Instant Redeem Check:`);
    console.log(`   Can redeem: ${canRedeem}`);
    console.log(`   Cap USDC: ${ethers.formatUnits(capUSDC, 6)} USDC`);
    console.log(`   Used USDC: ${ethers.formatUnits(usedUSDC, 6)} USDC`);
    console.log(`   Need USDC: ${ethers.formatUnits(needUSDC, 6)} USDC`);

    expect(canRedeem).to.be.true;
    expect(needUSDC).to.be.gt(0);
  });

  it("should support treasury operations with both USDC and BRICS", async () => {
    const treasuryOpsAddr = await treasuryOps.getAddress();
    const whaleAddr = await whale.getAddress();
    
    // Check treasury USDC balance
    const treasuryUsdcBalance = await usdcToken.balanceOf(await treasury.getAddress());
    const treasuryBricsBalance = await bricsToken.balanceOf(treasuryOpsAddr);
    
    console.log(`📊 Treasury Balances:`);
    console.log(`   USDC: ${ethers.formatUnits(treasuryUsdcBalance, 6)} USDC`);
    console.log(`   BRICS: ${ethers.formatUnits(treasuryBricsBalance, 18)} BRICS`);

    expect(treasuryUsdcBalance).to.be.gt(0);
    expect(treasuryBricsBalance).to.be.gt(0);

    // Treasury can pay USDC
    const payAmount = ethers.parseUnits("1000", 6); // 1000 USDC
    await treasury.connect(treasuryOps).pay(whaleAddr, payAmount);
    
    const whaleUsdcBalance = await usdcToken.balanceOf(whaleAddr);
    expect(whaleUsdcBalance).to.equal(payAmount);
  });

  it("should support whale operations with large BRICS amounts", async () => {
    const whaleAddr = await whale.getAddress();
    const memberAddr = await member.getAddress();
    
    const whaleBricsBalance = await bricsToken.balanceOf(whaleAddr);
    const initialMemberBalance = await bricsToken.balanceOf(memberAddr);
    console.log(`🐋 Whale BRICS balance: ${ethers.formatUnits(whaleBricsBalance, 18)} BRICS`);
    console.log(`👤 Initial member BRICS balance: ${ethers.formatUnits(initialMemberBalance, 18)} BRICS`);
    
    expect(whaleBricsBalance).to.be.gt(0);

    // Whale can transfer large amounts
    const transferAmount = ethers.parseUnits("100000", 18); // 100k BRICS
    await bricsToken.connect(whale).transfer(memberAddr, transferAmount);
    
    const finalMemberBalance = await bricsToken.balanceOf(memberAddr);
    expect(finalMemberBalance).to.equal(initialMemberBalance + transferAmount);
  });

  it("should verify token metadata and compatibility", async () => {
    // Verify BRICS token metadata
    expect(await bricsToken.name()).to.equal("Mock BRICS");
    expect(await bricsToken.symbol()).to.equal("mBRICS");
    expect(await bricsToken.decimals()).to.equal(18);

    // Verify USDC token metadata
    expect(await usdcToken.name()).to.equal("Mock USDC");
    expect(await usdcToken.symbol()).to.equal("mUSDC");
    expect(await usdcToken.decimals()).to.equal(6);

    // Verify total supply
    const bricsTotalSupply = await bricsToken.totalSupply();
    const usdcTotalSupply = await usdcToken.totalSupply();
    
    console.log(`📊 Token Supply:`);
    console.log(`   BRICS: ${ethers.formatUnits(bricsTotalSupply, 18)} BRICS`);
    console.log(`   USDC: ${ethers.formatUnits(usdcTotalSupply, 6)} USDC`);
    
    expect(bricsTotalSupply).to.be.gt(0);
    expect(usdcTotalSupply).to.be.gt(0);
  });
});
