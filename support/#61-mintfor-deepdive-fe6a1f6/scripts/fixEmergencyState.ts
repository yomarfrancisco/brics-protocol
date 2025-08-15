import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Diagnosing and fixing emergency state...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  console.log(`💰 Admin/Deployer: ${deployer.address}`);
  
  // Get contracts
  const configRegistry = await ethers.getContractAt("ConfigRegistry", deployment.core.ConfigRegistry);
  const issuanceController = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  console.log(`📋 ConfigRegistry: ${deployment.core.ConfigRegistry}`);
  console.log(`🎛️ IssuanceController: ${deployment.issuance.IssuanceControllerV3}`);
  
  // 1. Check current emergency state
  console.log(`\n📊 Current Emergency State:`);
  const emergencyLevel = await configRegistry.emergencyLevel();
  console.log(`   Emergency Level: ${emergencyLevel}`);
  
  const currentParams = await configRegistry.getCurrentParams();
  console.log(`   Current Params:`, currentParams);
  
  // 2. List available functions
  console.log(`\n🔧 Available Functions:`);
  const functions = Object.keys(configRegistry.interface.fragments).sort();
  functions.forEach(fn => console.log(`   ${fn}`));
  
  // 3. Check if we have admin role
  const DEFAULT_ADMIN_ROLE = await configRegistry.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await configRegistry.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(`\n🔑 Admin Role Check:`);
  console.log(`   DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);
  console.log(`   Deployer has admin role: ${hasAdminRole}`);
  
  // 4. Try to fix emergency state
  console.log(`\n🔧 Attempting to fix emergency state...`);
  
  // Try setEmergencyLevel(0) - NORMAL
  try {
    console.log(`   Trying setEmergencyLevel(0)...`);
    const tx1 = await configRegistry.setEmergencyLevel(0);
    await tx1.wait();
    console.log(`   ✅ setEmergencyLevel(0) succeeded!`);
  } catch (error: any) {
    console.log(`   ❌ setEmergencyLevel(0) failed: ${error.message}`);
    
    // If it's a role issue, try to grant the role
    if (error.message.includes("AccessControl") || error.message.includes("role")) {
      console.log(`   🔑 Attempting to grant admin role...`);
      try {
        const grantTx = await configRegistry.grantRole(DEFAULT_ADMIN_ROLE, deployer.address);
        await grantTx.wait();
        console.log(`   ✅ Admin role granted!`);
        
        // Try setEmergencyLevel again
        const tx2 = await configRegistry.setEmergencyLevel(0);
        await tx2.wait();
        console.log(`   ✅ setEmergencyLevel(0) succeeded after role grant!`);
      } catch (grantError: any) {
        console.log(`   ❌ Role grant failed: ${grantError.message}`);
      }
    }
  }
  
  // 5. Check final state
  console.log(`\n📊 Final Emergency State:`);
  const finalEmergencyLevel = await configRegistry.emergencyLevel();
  console.log(`   Emergency Level: ${finalEmergencyLevel}`);
  
  const finalParams = await configRegistry.getCurrentParams();
  console.log(`   Final Params:`, finalParams);
  
  // 6. Test if issuance is now allowed
  console.log(`\n🧪 Testing issuance capability...`);
  try {
    const canIssue = await issuanceController.canIssue(ethers.parseUnits("100", 6), 0, 0);
    console.log(`   canIssue(100 USDC): ${canIssue}`);
  } catch (error: any) {
    console.log(`   ❌ canIssue check failed: ${error.message}`);
  }
  
  // 7. Test USDC approve and mint directly
  console.log(`\n🧪 Testing direct approve and mint...`);
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC) as any;
  
  try {
    // Impersonate user wallet
    await ethers.provider.send("hardhat_impersonateAccount", [userWallet]);
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    
    // Test approve
    const approveAmount = ethers.parseUnits("100", 6);
    const approveTx = await usdc.connect(userSigner).approve(
      deployment.issuance.IssuanceControllerV3,
      approveAmount
    );
    await approveTx.wait();
    console.log(`   ✅ USDC approve succeeded!`);
    
    // Test mint
    const mintTx = await (issuanceController as any).connect(userSigner).mintFor(
      userWallet,
      ethers.parseUnits("100", 6),
      0, // sovereignId
      0  // claimId
    );
    await mintTx.wait();
    console.log(`   ✅ mintFor succeeded!`);
    
  } catch (error: any) {
    console.log(`   ❌ Direct test failed: ${error.message}`);
  }
  
  console.log(`\n🎉 Emergency state fix complete!`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Make sure MetaMask is connected to Hardhat Local (Chain ID 31337)`);
  console.log(`   2. Try the approve and mint buttons in the frontend`);
  console.log(`   3. If it still fails, check the browser console for specific errors`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
