import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🧪 Testing mint function...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  
  // Get contracts with correct addresses
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  const issuanceController = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  console.log(`🏦 USDC: ${deployment.finance.USDC}`);
  console.log(`🎛️ IssuanceController: ${deployment.issuance.IssuanceControllerV3}`);
  
  // Check user's balances
  const userBalance = await usdc.balanceOf(userWallet);
  const bricsToken = await ethers.getContractAt("BRICSToken", deployment.tranche.BRICSToken);
  const userBricsBalance = await bricsToken.balanceOf(userWallet);
  
  console.log(`\n💰 User USDC balance: ${ethers.formatUnits(userBalance, 6)} USDC`);
  console.log(`🏭 User BRICS balance: ${ethers.formatUnits(userBricsBalance, 18)} BRICS`);
  
  // Check allowance
  const currentAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
  console.log(`📋 Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
  
  // Try to mint with user wallet
  console.log(`\n🏭 Testing mint with user wallet...`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    const mintAmount = ethers.parseUnits("100", 6); // 100 USDC
    
    console.log(`   Minting ${ethers.formatUnits(mintAmount, 6)} USDC worth of BRICS...`);
    const mintTx = await issuanceController.connect(userSigner).mintFor(
      userWallet,
      mintAmount,
      0, // minBRICS
      0  // maxBRICS
    );
    await mintTx.wait();
    console.log(`   ✅ Mint successful!`);
    
    // Check new balances
    const newUserBalance = await usdc.balanceOf(userWallet);
    const newUserBricsBalance = await bricsToken.balanceOf(userWallet);
    
    console.log(`\n📊 New Balances:`);
    console.log(`   USDC: ${ethers.formatUnits(newUserBalance, 6)} USDC`);
    console.log(`   BRICS: ${ethers.formatUnits(newUserBricsBalance, 18)} BRICS`);
    
  } catch (error) {
    console.error(`   ❌ Mint failed:`, error.message);
    
    // Try to get more details about the error
    if (error.data) {
      console.log(`   📄 Error data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   📄 Error reason: ${error.reason}`);
    }
  }
  
  console.log(`\n🎉 Mint test complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
