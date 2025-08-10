import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Testing frontend error reproduction...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  
  // Get contracts
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  const issuanceController = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  console.log(`🏦 USDC: ${deployment.finance.USDC}`);
  console.log(`🏭 IssuanceController: ${deployment.issuance.IssuanceControllerV3}`);
  
  // Test 1: Direct USDC approve (this worked in our previous test)
  console.log(`\n🧪 Test 1: Direct USDC approve...`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    const approveAmount = ethers.parseUnits("100", 6);
    
    const approveTx = await usdc.connect(userSigner).approve(
      deployment.issuance.IssuanceControllerV3,
      approveAmount
    );
    await approveTx.wait();
    console.log(`   ✅ Direct approve successful`);
  } catch (error) {
    console.error(`   ❌ Direct approve failed:`, error.message);
  }
  
  // Test 2: Try to mint (this might trigger the circuit breaker error)
  console.log(`\n🧪 Test 2: Try to mint BRICS...`);
  try {
    const userSigner = await ethers.getImpersonatedSigner(userWallet);
    const mintAmount = ethers.parseUnits("10", 6); // 10 USDC
    
    // Check if user has OPS_ROLE
    const OPS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPS"));
    const hasOpsRole = await issuanceController.hasRole(OPS_ROLE, userWallet);
    console.log(`   User has OPS_ROLE: ${hasOpsRole}`);
    
    // Check allowance
    const allowance = await usdc.allowance(userWallet, deployment.issuance.IssuanceControllerV3);
    console.log(`   Current allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
    
    // Try to mint
    const mintTx = await issuanceController.connect(userSigner).mintFor(
      userWallet,
      mintAmount,
      0, // minTokensOut
      0  // deadline
    );
    await mintTx.wait();
    console.log(`   ✅ Mint successful`);
  } catch (error) {
    console.error(`   ❌ Mint failed:`, error.message);
    
    // Check if this is the circuit breaker error
    if (error.message.includes("circuit breaker") || error.message.includes("Halted")) {
      console.log(`\n🔧 Circuit breaker detected! Let's investigate...`);
      
      // Check emergency level
      const configRegistry = await ethers.getContractAt("ConfigRegistry", deployment.core.ConfigRegistry);
      const emergencyLevel = await configRegistry.emergencyLevel();
      const maxIssuanceRate = await configRegistry.currentMaxIssuanceRateBps();
      
      console.log(`   Emergency level: ${emergencyLevel}`);
      console.log(`   Max issuance rate: ${maxIssuanceRate} bps`);
      
      if (maxIssuanceRate === 0n) {
        console.log(`   ❌ Issuance is halted due to emergency level ${emergencyLevel}`);
      }
    }
  }
  
  // Test 3: Check if there are any other pause mechanisms
  console.log(`\n🧪 Test 3: Checking for other pause mechanisms...`);
  
  // Check if any contracts have a paused() function
  const contracts = [
    { name: "USDC", address: deployment.finance.USDC, contract: usdc },
    { name: "IssuanceController", address: deployment.issuance.IssuanceControllerV3, contract: issuanceController }
  ];
  
  for (const { name, address, contract } of contracts) {
    try {
      const paused = await contract.paused();
      console.log(`   ${name} paused: ${paused}`);
    } catch (e) {
      console.log(`   ${name} has no paused() function`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
