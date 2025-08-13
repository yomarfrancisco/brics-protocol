import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { fundBRICS } from "../utils/fundBRICS";

describe("BRICS Token Deployment", () => {
  let bricsToken: Contract;
  let treasury: Signer;
  let whale: Signer;
  let deployer: Signer;
  let treasuryAddr: string;
  let whaleAddr: string;
  let deployerAddr: string;

  beforeEach(async () => {
    [deployer, treasury, whale] = await ethers.getSigners();
    treasuryAddr = await treasury.getAddress();
    whaleAddr = await whale.getAddress();
    deployerAddr = await deployer.getAddress();

    // Deploy MockBRICSToken
    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    bricsToken = await MockBRICSToken.deploy();
    await bricsToken.waitForDeployment();
  });

  it("should deploy BRICS token and allocate to treasury and whale", async () => {
    // Define total allocation to distribute
    const TOTAL_ALLOCATION = ethers.parseUnits("60000000", 18); // 60M BRICS total (divisible by 3)
    const EXPECTED_PER_RECIPIENT = TOTAL_ALLOCATION / 3n; // 20M BRICS each

    // Fund all participants using the helper
    await fundBRICS(bricsToken, [treasuryAddr, whaleAddr, deployerAddr], {
      amount: TOTAL_ALLOCATION
    });

    // Verify balances
    const treasuryBalance = await bricsToken.balanceOf(treasuryAddr);
    const whaleBalance = await bricsToken.balanceOf(whaleAddr);
    const deployerBalance = await bricsToken.balanceOf(deployerAddr);

    expect(treasuryBalance).to.equal(EXPECTED_PER_RECIPIENT);
    expect(whaleBalance).to.equal(EXPECTED_PER_RECIPIENT);
    expect(deployerBalance).to.equal(EXPECTED_PER_RECIPIENT);

    console.log(`📊 Final Balances:`);
    console.log(`   Treasury: ${ethers.formatUnits(treasuryBalance, 18)} BRICS`);
    console.log(`   Whale: ${ethers.formatUnits(whaleBalance, 18)} BRICS`);
    console.log(`   Deployer: ${ethers.formatUnits(deployerBalance, 18)} BRICS`);
  });

  it("should support treasury operations with BRICS", async () => {
    // Fund treasury with BRICS
    const treasuryAmount = ethers.parseUnits("1000000", 18); // 1M BRICS
    await fundBRICS(bricsToken, [treasuryAddr], { amount: treasuryAmount });

    // Treasury can transfer BRICS
    const transferAmount = ethers.parseUnits("100000", 18); // 100k BRICS
    await bricsToken.connect(treasury).transfer(deployerAddr, transferAmount);

    const treasuryBalance = await bricsToken.balanceOf(treasuryAddr);
    const deployerBalance = await bricsToken.balanceOf(deployerAddr);

    expect(treasuryBalance).to.equal(treasuryAmount - transferAmount);
    expect(deployerBalance).to.equal(transferAmount);
  });

  it("should support whale operations with BRICS", async () => {
    // Fund whale with BRICS
    const whaleAmount = ethers.parseUnits("50000000", 18); // 50M BRICS
    await fundBRICS(bricsToken, [whaleAddr], { amount: whaleAmount });

    // Whale can transfer large amounts
    const transferAmount = ethers.parseUnits("10000000", 18); // 10M BRICS
    await bricsToken.connect(whale).transfer(deployerAddr, transferAmount);

    const whaleBalance = await bricsToken.balanceOf(whaleAddr);
    const deployerBalance = await bricsToken.balanceOf(deployerAddr);

    expect(whaleBalance).to.equal(whaleAmount - transferAmount);
    expect(deployerBalance).to.equal(transferAmount);
  });

  it("should verify token metadata", async () => {
    expect(await bricsToken.name()).to.equal("Mock BRICS");
    expect(await bricsToken.symbol()).to.equal("mBRICS");
    expect(await bricsToken.decimals()).to.equal(18);
  });
});
