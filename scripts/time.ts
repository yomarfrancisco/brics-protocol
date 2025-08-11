import { ethers } from "hardhat";

export async function fastForward(seconds: number): Promise<void> {
  const currentBlock = await ethers.provider.getBlock("latest");
  const newTimestamp = (currentBlock?.timestamp || 0) + seconds;
  await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
  await ethers.provider.send("evm_mine", []);
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine", []);
}

export async function getCurrentTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block?.timestamp || 0;
}

export async function mineBlocks(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}
