// test/utils/nav-helpers.ts
import { ethers } from "hardhat";

// Constants as BigInt
export const USDC_DECIMALS = 6n;
export const RAY = 10n ** 27n;
export const WAD = 10n ** 18n;
export const USDC_ONE = 10n ** USDC_DECIMALS;

// Round-half-up division for BigInt
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  // assumes d > 0
  return (n + d / 2n) / d;
}

// Get NAV ray from oracle in a version-proof way (no direct impl-specific calls)
export async function getNavRayCompat(oracle: any): Promise<bigint> {
  if (oracle.latestNAVRay) {
    const v = await oracle.latestNAVRay();
    return BigInt(v.toString());
  }
  if (oracle.latestNAV) {
    // Some mocks expose latestNAV() scaled 1e27
    const v = await oracle.latestNAV();
    return BigInt(v.toString());
  }
  // Fallback: read a public storage var if exposed in mocks
  const v = await oracle.navRay?.();
  return BigInt(v?.toString() ?? RAY.toString());
}

// Set NAV on mock in a compatible way (no direct storage pokes)
export async function setNavCompat(oracle: any, navRay: bigint, ts?: number) {
  if (oracle.setNavRay) {
    await oracle.setNavRay(navRay.toString());
    return;
  }
  if (oracle.setLatestNAVRay) {
    await oracle.setLatestNAVRay(navRay.toString());
    return;
  }
  if (oracle.setNAV) {
    await oracle.setNAV(navRay.toString());
    return;
  }
  if (oracle.submitNAV) {
    // prefer submit (updates timestamp)
    await oracle.submitNAV(navRay.toString(), ts ?? (await now()));
    return;
  }
}

// Token (WAD) -> USDC using NAV ray (1e27)
export function tokensToUSDC(tokenAmountWad: bigint, navRay: bigint): bigint {
  // token WAD * price(RAY) -> scale to USDC (1e6)
  // amountUSDC = round((token * nav) / (1e27 / 1e6)) = round(token * nav / 1e21)
  const num = tokenAmountWad * navRay;         // up to 1e45
  const denom = RAY / USDC_ONE;                // 1e21
  return divRoundHalfUp(num, denom);
}

// USDC -> Token (WAD) using NAV ray (1e27)
export function usdcToTokens(usdcAmount: bigint, navRay: bigint): bigint {
  // inverse of above: token = round(USDC * (1e21) / nav)
  const num = usdcAmount * (RAY / USDC_ONE);
  return divRoundHalfUp(num, navRay);
}

// Time helpers (re-export so tests share a single source of truth)
export async function now(): Promise<number> {
  const b = await ethers.provider.getBlock("latest");
  return b.timestamp;
}

// Increase to (never go backwards)
export async function safeIncreaseTo(ts: number | bigint) {
  const target = Number(ts);
  const cur = await now();
  const next = Math.max(target, cur + 1);
  await ethers.provider.send("evm_setNextBlockTimestamp", [ next ]);
  await ethers.provider.send("evm_mine", []);
}
