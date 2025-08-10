import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Verifying contract addresses and functionality...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  console.log(`💰 Deployer: ${deployer.address}`);
  
  // Test USDC contract
  console.log(`\n💵 Testing USDC contract...`);
  console.log(`   Address: ${deployment.finance.USDC}`);
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  const usdcBalance = await usdc.balanceOf(deployer.address);
  console.log(`   Deployer balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  
  // Test IssuanceController
  console.log(`\n🏭 Testing IssuanceController...`);
  console.log(`   Address: ${deployment.issuance.IssuanceControllerV3}`);
  const controller = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  // Check if deployer has OPS_ROLE
  const OPS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPS"));
  const hasOpsRole = await controller.hasRole(OPS_ROLE, deployer.address);
  console.log(`   Deployer has OPS_ROLE: ${hasOpsRole}`);
  
  // Test user wallet
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  const userHasOpsRole = await controller.hasRole(OPS_ROLE, userWallet);
  console.log(`   User wallet has OPS_ROLE: ${userHasOpsRole}`);
  
  // Test user balances
  const userUsdcBalance = await usdc.balanceOf(userWallet);
  console.log(`   User USDC balance: ${ethers.formatUnits(userUsdcBalance, 6)} USDC`);
  
  // Test BRICS token
  const bricsToken = await ethers.getContractAt("BRICSToken", deployment.tranche.BRICSToken);
  const userBricsBalance = await bricsToken.balanceOf(userWallet);
  console.log(`   User BRICS balance: ${ethers.formatUnits(userBricsBalance, 18)} BRICS`);
  
  console.log(`\n✅ Address verification complete!`);
  console.log(`\n📋 Frontend should use these addresses:`);
  console.log(`   USDC: ${deployment.finance.USDC}`);
  console.log(`   IssuanceControllerV3: ${deployment.issuance.IssuanceControllerV3}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
