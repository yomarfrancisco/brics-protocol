import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  console.log("🔓 Unpausing USDC contract...\n");
  
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  const [deployer] = await ethers.getSigners();
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`💰 Deployer: ${deployer.address}`);
  console.log(`👤 User wallet: ${userWallet}`);
  
  // Get USDC contract
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  console.log(`🏦 USDC: ${deployment.finance.USDC}`);
  
  // Check if contract is paused
  try {
    const isPaused = await usdc.paused();
    console.log(`\n📊 Contract paused status: ${isPaused}`);
    
    if (isPaused) {
      console.log(`\n🔓 Contract is paused. Attempting to unpause...`);
      
      // Try to unpause directly first
      try {
        const unpauseTx = await usdc.unpause();
        await unpauseTx.wait();
        console.log(`✅ Contract unpaused successfully!`);
      } catch (error) {
        console.log(`❌ Direct unpause failed: ${error.message}`);
        
        // Check if we need to grant PAUSER_ROLE
        try {
          const PAUSER_ROLE = await usdc.PAUSER_ROLE();
          console.log(`\n🔑 PAUSER_ROLE: ${PAUSER_ROLE}`);
          
          const hasRole = await usdc.hasRole(PAUSER_ROLE, userWallet);
          console.log(`👤 User has PAUSER_ROLE: ${hasRole}`);
          
          if (!hasRole) {
            console.log(`\n🔑 Granting PAUSER_ROLE to user wallet...`);
            const grantTx = await usdc.grantRole(PAUSER_ROLE, userWallet);
            await grantTx.wait();
            console.log(`✅ PAUSER_ROLE granted to ${userWallet}`);
          }
          
          // Now try to unpause with user wallet
          console.log(`\n🔓 Attempting to unpause with user wallet...`);
          const userSigner = await ethers.getImpersonatedSigner(userWallet);
          const unpauseTx = await usdc.connect(userSigner).unpause();
          await unpauseTx.wait();
          console.log(`✅ Contract unpaused by user wallet!`);
          
        } catch (roleError) {
          console.error(`❌ Role management failed:`, roleError.message);
        }
      }
    } else {
      console.log(`✅ Contract is already unpaused!`);
    }
    
    // Verify final status
    const finalPausedStatus = await usdc.paused();
    console.log(`\n📊 Final paused status: ${finalPausedStatus}`);
    
  } catch (error) {
    console.error(`❌ Error checking pause status:`, error.message);
  }
  
  console.log(`\n🎉 USDC unpause process complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
