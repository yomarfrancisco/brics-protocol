import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const DAO = process.env.DAO_MULTISIG || deployer.address;
  const TREASURY_OPS = process.env.TREASURY_OPS_MULTISIG || deployer.address;
  const WHALE_ADDRESS = process.env.BRICS_WHALE_ADDRESS || deployer.address;

  // BRICS Token Deployment
  let bricsTokenAddr = process.env.BRICS_TOKEN_ADDRESS;
  if (!bricsTokenAddr || bricsTokenAddr === "0xMockOrRealBRICSOnNetwork") {
    // Deploy MockBRICSToken for testing/development
    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    const bricsToken = await MockBRICSToken.deploy();
    await bricsToken.waitForDeployment();
    bricsTokenAddr = await bricsToken.getAddress();
    
    console.log(`🔧 Deployed MockBRICSToken at: ${bricsTokenAddr}`);
  } else {
    // Use existing BRICS token address
    console.log(`🔧 Using existing BRICS token at: ${bricsTokenAddr}`);
  }

  // Get BRICS token contract
  const bricsToken = await ethers.getContractAt("IERC20", bricsTokenAddr);

  // Initial allocations
  const TREASURY_ALLOCATION = ethers.parseUnits("10000000", 18); // 10M BRICS for treasury
  const WHALE_ALLOCATION = ethers.parseUnits("50000000", 18);    // 50M BRICS for whale
  const DEPLOYER_ALLOCATION = ethers.parseUnits("1000000", 18);  // 1M BRICS for deployer

  // Mint initial allocations if using MockBRICSToken
  if (!process.env.BRICS_TOKEN_ADDRESS || process.env.BRICS_TOKEN_ADDRESS === "0xMockOrRealBRICSOnNetwork") {
    const mockBrics = await ethers.getContractAt("MockBRICSToken", bricsTokenAddr);
    
    // Mint to deployer first (who will distribute)
    await (await mockBrics.mint(deployer.address, TREASURY_ALLOCATION + WHALE_ALLOCATION + DEPLOYER_ALLOCATION)).wait();
    
    console.log(`💰 Minted ${ethers.formatUnits(TREASURY_ALLOCATION + WHALE_ALLOCATION + DEPLOYER_ALLOCATION, 18)} BRICS to deployer`);
    
    // Transfer to treasury
    await (await bricsToken.transfer(TREASURY_OPS, TREASURY_ALLOCATION)).wait();
    console.log(`🏦 Transferred ${ethers.formatUnits(TREASURY_ALLOCATION, 18)} BRICS to treasury (${TREASURY_OPS})`);
    
    // Transfer to whale
    await (await bricsToken.transfer(WHALE_ADDRESS, WHALE_ALLOCATION)).wait();
    console.log(`🐋 Transferred ${ethers.formatUnits(WHALE_ALLOCATION, 18)} BRICS to whale (${WHALE_ADDRESS})`);
    
    // Deployer keeps DEPLOYER_ALLOCATION
    console.log(`👤 Deployer keeps ${ethers.formatUnits(DEPLOYER_ALLOCATION, 18)} BRICS`);
  } else {
    console.log(`⚠️  Using existing BRICS token - skipping allocations`);
    console.log(`   Treasury should have: ${ethers.formatUnits(TREASURY_ALLOCATION, 18)} BRICS`);
    console.log(`   Whale should have: ${ethers.formatUnits(WHALE_ALLOCATION, 18)} BRICS`);
  }

  // Verify balances
  const treasuryBalance = await bricsToken.balanceOf(TREASURY_OPS);
  const whaleBalance = await bricsToken.balanceOf(WHALE_ADDRESS);
  const deployerBalance = await bricsToken.balanceOf(deployer.address);

  console.log(`\n📊 Final Balances:`);
  console.log(`   Treasury (${TREASURY_OPS}): ${ethers.formatUnits(treasuryBalance, 18)} BRICS`);
  console.log(`   Whale (${WHALE_ADDRESS}): ${ethers.formatUnits(whaleBalance, 18)} BRICS`);
  console.log(`   Deployer (${deployer.address}): ${ethers.formatUnits(deployerBalance, 18)} BRICS`);

  // Save to deployment state
  state.brics = {
    BRICSToken: bricsTokenAddr,
    Treasury: TREASURY_OPS,
    Whale: WHALE_ADDRESS,
    TreasuryAllocation: TREASURY_ALLOCATION.toString(),
    WhaleAllocation: WHALE_ALLOCATION.toString(),
    DeployerAllocation: DEPLOYER_ALLOCATION.toString()
  };
  
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("\n✅ BRICS token deployment complete:", state.brics);
}

main().catch((e) => { 
  console.error(e); 
  process.exit(1); 
});

