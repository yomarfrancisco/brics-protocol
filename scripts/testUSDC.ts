import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  console.log(`💰 Deployer: ${deployer.address}`);
  
  // Get USDC contract
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  console.log(`🏦 USDC Address: ${deployment.finance.USDC}`);
  
  // Check USDC balance
  const balance = await usdc.balanceOf(deployer.address);
  console.log(`💵 USDC Balance: ${ethers.formatUnits(balance, 6)}`);
  
  // Check if we can call approve
  const issuanceController = deployment.issuance.IssuanceControllerV3;
  const approveAmount = ethers.parseUnits("1000", 6);
  
  console.log(`\n🔍 Testing USDC approve...`);
  console.log(`   To: ${issuanceController}`);
  console.log(`   Amount: ${ethers.formatUnits(approveAmount, 6)} USDC`);
  
  try {
    const approveTx = await usdc.approve(issuanceController, approveAmount);
    await approveTx.wait();
    console.log(`✅ Approve successful!`);
    
    // Check allowance
    const allowance = await usdc.allowance(deployer.address, issuanceController);
    console.log(`📋 Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
    
  } catch (error) {
    console.error(`❌ Approve failed:`, error);
    
    // Try to get more details about the error
    if (error.data) {
      console.log(`🔍 Error data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`🔍 Error reason: ${error.reason}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

