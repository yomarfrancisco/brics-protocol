import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔍 Checking emergency configuration...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  
  // Get ConfigRegistry contract
  const configRegistry = await ethers.getContractAt("ConfigRegistry", deployment.core.ConfigRegistry);
  console.log(`🏛️ ConfigRegistry: ${deployment.core.ConfigRegistry}`);
  
  // Check current emergency level
  const emergencyLevel = await configRegistry.emergencyLevel();
  console.log(`🚨 Current emergency level: ${emergencyLevel}`);
  
  // Check current max issuance rate
  const maxIssuanceRate = await configRegistry.currentMaxIssuanceRateBps();
  console.log(`📊 Current max issuance rate: ${maxIssuanceRate} bps (${Number(maxIssuanceRate)/100}%)`);
  
  // Check if issuance is halted
  if (maxIssuanceRate === 0n) {
    console.log(`❌ ISSUANCE IS HALTED - maxIssuanceRateBps is 0`);
  } else {
    console.log(`✅ Issuance is active`);
  }
  
  // Get emergency parameters for current level
  const params = await configRegistry.emergencyParams(emergencyLevel);
  console.log(`\n📋 Emergency level ${emergencyLevel} parameters:`);
  console.log(`   maxIssuanceRateBps: ${params.maxIssuanceRateBps}`);
  console.log(`   maxRedeemRateBps: ${params.maxRedeemRateBps}`);
  console.log(`   maxSovUtilBps: ${params.maxSovUtilBps}`);
  console.log(`   maxTailBps: ${params.maxTailBps}`);
  
  // Check if we need to set emergency level to 0 (normal)
  if (emergencyLevel !== 0) {
    console.log(`\n🔧 Setting emergency level to 0 (normal)...`);
    try {
      const tx = await configRegistry.setEmergencyLevel(0);
      await tx.wait();
      console.log(`✅ Emergency level set to 0`);
      
      // Check new max issuance rate
      const newMaxIssuanceRate = await configRegistry.currentMaxIssuanceRateBps();
      console.log(`📊 New max issuance rate: ${newMaxIssuanceRate} bps (${Number(newMaxIssuanceRate)/100}%)`);
    } catch (error) {
      console.error(`❌ Failed to set emergency level:`, error.message);
    }
  } else {
    console.log(`\n✅ Emergency level is already 0 (normal)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
