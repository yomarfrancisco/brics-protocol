import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Your connected MetaMask account
  const targetAccount = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // This is the account you imported
  const targetAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // The actual address
  
  // Get USDC contract
  const usdcAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  
  console.log(`Funding account ${targetAddress} with test USDC...`);
  
  // Mint 100,000 USDC to the target account (6 decimals)
  const amount = ethers.parseUnits("100000", 6);
  await (await usdc.mint(targetAddress, amount)).wait();
  
  // Check balance
  const balance = await usdc.balanceOf(targetAddress);
  console.log(`✅ Account funded with ${ethers.formatUnits(balance, 6)} USDC`);
  
  // Also check ETH balance (should already have 10,000 ETH)
  const ethBalance = await ethers.provider.getBalance(targetAddress);
  console.log(`💰 ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


