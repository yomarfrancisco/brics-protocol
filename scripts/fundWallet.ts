import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  // Target wallet address (hardcoded for debugging, previously argument)
  const targetWallet = "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1"; 
  
  console.log(`🎯 Funding wallet: ${targetWallet}`);
  
  const deployment = JSON.parse(readFileSync("deployments-localhost.json", "utf8"));
  const [deployer] = await ethers.getSigners();
  const usdc = await ethers.getContractAt("MockUSDC", deployment.finance.USDC);
  const bricsToken = await ethers.getContractAt("BRICSToken", deployment.tranche.BRICSToken);
  const operationalAgreement = await ethers.getContractAt("OperationalAgreement", deployment.core.OperationalAgreement);

  // 1. Send ETH
  console.log(`\n💰 Sending ETH...`);
  const ethTx = await deployer.sendTransaction({
    to: targetWallet,
    value: ethers.parseEther("10")
  });
  await ethTx.wait();
  console.log(`✅ ETH sent!`);

  // 2. Send USDC
  console.log(`\n💵 Sending USDC...`);
  const usdcAmount = ethers.parseUnits("10000", 6);
  const usdcTx = await usdc.transfer(targetWallet, usdcAmount);
  await usdcTx.wait();
  console.log(`✅ USDC sent!`);
  
  // 3. Add wallet to member registry
  console.log(`\n👤 Adding wallet to member registry...`);
  const memberTx = await operationalAgreement.approveMember(targetWallet);
  await memberTx.wait();
  console.log(`✅ Wallet added as member!`);
  
  // 4. Mint BRICS tokens directly to the wallet
  const bricsAmount = ethers.parseUnits("1000", 18);
  console.log(`\n🏭 Minting ${ethers.formatUnits(bricsAmount, 18)} BRICS...`);
  const mintTx = await bricsToken.mint(targetWallet, bricsAmount);
  await mintTx.wait();
  console.log(`✅ BRICS minted!`);
  
  // 5. Check balances
  const ethBalance = await ethers.provider.getBalance(targetWallet);
  const usdcBalance = await usdc.balanceOf(targetWallet);
  const bricsBalance = await bricsToken.balanceOf(targetWallet);
  
  console.log(`\n📊 Final Balances:`);
  console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
  console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`   BRICS: ${ethers.formatUnits(bricsBalance, 18)}`);
  
  console.log(`\n🎉 Wallet funding complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
