import { ethers } from "hardhat";

export async function chainNow() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function openWindow(ic: any, minDays = 2) {
  const now = await chainNow();
  const closeTs = now + minDays * 24 * 60 * 60 + 60; // +60s safety
  await ic.openNavWindow(closeTs);
  return closeTs;
}

export async function fastForwardTo(ts: number) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
  await ethers.provider.send("evm_mine", []);
}

export async function fastForwardBy(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}
