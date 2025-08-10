import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Checking USDC contract state...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  
  // Get USDC contract
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  console.log(`🏦 USDC Address: ${deployment.finance.USDC}`);
  
  // Check balances
  const deployerBalance = await usdc.balanceOf(deployer.address);
  const userBalance = await usdc.balanceOf(userWallet);
  console.log(`\n💵 Balances:`);
  console.log(`   Deployer: ${ethers.formatUnits(deployerBalance, 6)} USDC`);
  console.log(`   User: ${ethers.formatUnits(userBalance, 6)} USDC`);
  
  // Check current allowance
  const currentAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
  console.log(`\n📋 Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
  
  // Try to approve from user wallet
  console.log(`\n🔍 Testing approve from user wallet...`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    
    // Fund the user with some ETH for gas
    await deployer.sendTransaction({
      to: userWallet,
      value: ethers.parseEther("1")
    });
    
    const approveAmount = ethers.parseUnits("100", 6);
    const approveTx = await usdc.connect(userSigner).approve(
      deployment.issuance.IssuanceControllerV3,
      approveAmount
    );
    
    console.log(`   Approve transaction: ${approveTx.hash}`);
    await approveTx.wait();
    console.log(`   ✅ Approve successful!`);
    
    // Check new allowance
    const newAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
    console.log(`   New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
    
  } catch (error) {
    console.error(`   ❌ Approve failed:`, error.message);
    
    // Try to get more details about the error
    if (error.message.includes("circuit breaker")) {
      console.log(`\n🔧 Circuit breaker detected! Let's check if there's a pause mechanism...`);
      
      // Check if the contract has a paused() function
      try {
        const paused = await usdc.paused();
        console.log(`   Contract paused: ${paused}`);
        if (paused) {
          console.log(`   🔓 Need to unpause the contract`);
        }
      } catch (e) {
        console.log(`   No paused() function found - this might be a different issue`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
