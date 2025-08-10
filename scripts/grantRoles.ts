import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  // Read deployment addresses
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  
  // User's wallet address
  const userWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1";
  
  console.log(`🎯 Granting OPS_ROLE to wallet: ${userWallet}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`💰 Deployer: ${deployer.address}`);
  
  // Get IssuanceController contract
  const issuanceController = await ethers.getContractAt("IssuanceControllerV3", deployment.issuance.IssuanceControllerV3);
  
  // Grant OPS_ROLE to user wallet
  console.log(`\n🔑 Granting OPS_ROLE...`);
  const OPS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPS"));
  const grantTx = await issuanceController.grantRole(OPS_ROLE, userWallet);
  await grantTx.wait();
  console.log(`✅ OPS_ROLE granted!`);
  
  console.log(`\n🎉 Role assignment complete!`);
  console.log(`\n🔍 Your wallet ${userWallet} now has OPS_ROLE and can mint BRICS!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

