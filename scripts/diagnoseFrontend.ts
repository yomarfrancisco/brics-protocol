import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Diagnosing frontend issues...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  // Check contract addresses
  console.log(`\n📋 Contract Addresses:`);
  console.log(`   USDC: ${deployment.finance.USDC}`);
  console.log(`   IssuanceController: ${deployment.issuance.IssuanceControllerV3}`);
  
  // Get contracts
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  const issuanceController = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  // Check if contracts are deployed
  console.log(`\n🔍 Contract Deployment Status:`);
  try {
    const usdcCode = await ethers.provider.getCode(deployment.finance.USDC);
    console.log(`   USDC deployed: ${usdcCode !== "0x" ? "✅ Yes" : "❌ No"}`);
    
    const controllerCode = await ethers.provider.getCode(deployment.issuance.IssuanceControllerV3);
    console.log(`   IssuanceController deployed: ${controllerCode !== "0x" ? "✅ Yes" : "❌ No"}`);
  } catch (error) {
    console.log(`   ❌ Error checking deployment: ${error.message}`);
  }
  
  // Check user balances
  console.log(`\n💰 User Balances:`);
  try {
    const userBalance = await usdc.balanceOf(userWallet);
    console.log(`   USDC: ${ethers.formatUnits(userBalance, 6)} USDC`);
    
    const bricsToken = await ethers.getContractAt("BRICSToken", deployment.tranche.BRICSToken);
    const userBricsBalance = await bricsToken.balanceOf(userWallet);
    console.log(`   BRICS: ${ethers.formatUnits(userBricsBalance, 18)} BRICS`);
  } catch (error) {
    console.log(`   ❌ Error checking balances: ${error.message}`);
  }
  
  // Check allowance
  console.log(`\n📋 Allowance Status:`);
  try {
    const allowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
    console.log(`   Current allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
  } catch (error) {
    console.log(`   ❌ Error checking allowance: ${error.message}`);
  }
  
  // Check roles
  console.log(`\n🔑 Role Status:`);
  try {
    const OPS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPS"));
    const hasRole = await issuanceController.hasRole(OPS_ROLE, userWallet);
    console.log(`   User has OPS_ROLE: ${hasRole ? "✅ Yes" : "❌ No"}`);
  } catch (error) {
    console.log(`   ❌ Error checking roles: ${error.message}`);
  }
  
  // Test approve function directly
  console.log(`\n🧪 Testing Approve Function:`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    const approveAmount = ethers.parseUnits("100", 6);
    
    console.log(`   Attempting to approve ${ethers.formatUnits(approveAmount, 6)} USDC...`);
    const approveTx = await usdc.connect(userSigner).approve(
      deployment.issuance.IssuanceControllerV3,
      approveAmount
    );
    await approveTx.wait();
    console.log(`   ✅ Approve successful!`);
    
    const newAllowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
    console.log(`   New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
    
  } catch (error) {
    console.log(`   ❌ Approve failed: ${error.message}`);
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   Error reason: ${error.reason}`);
    }
  }
  
  console.log(`\n🎉 Diagnosis complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
