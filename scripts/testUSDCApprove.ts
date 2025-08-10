import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🧪 Testing USDC approve function...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  
  // Get USDC contract
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  console.log(`🏦 USDC: ${deployment.finance.USDC}`);
  
  // Check user's USDC balance
  const userBalance = await usdc.balanceOf(userWallet);
  console.log(`\n💰 User USDC balance: ${ethers.formatUnits(userBalance, 6)} USDC`);
  
  // Check current allowance
  const currentAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
  console.log(`📋 Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
  
  // Try to approve with user wallet
  console.log(`\n🔓 Testing approve with user wallet...`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    const approveAmount = ethers.parseUnits("100", 6);
    
    console.log(`   Approving ${ethers.formatUnits(approveAmount, 6)} USDC...`);
    const approveTx = await usdc.connect(userSigner).approve(
      deployment.issuance.IssuanceControllerV3,
      approveAmount
    );
    await approveTx.wait();
    console.log(`   ✅ Approve successful!`);
    
    // Check new allowance
    const newAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
    console.log(`   📋 New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
    
  } catch (error) {
    console.error(`   ❌ Approve failed:`, error.message);
    
    // Try to get more details about the error
    if (error.data) {
      console.log(`   📄 Error data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   📄 Error reason: ${error.reason}`);
    }
  }
  
  console.log(`\n🎉 USDC approve test complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
