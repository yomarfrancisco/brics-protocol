// test/utils/nav-helpers.ts
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Constants as BigInt
export const USDC_DECIMALS = 6n;
export const RAY = 10n ** 27n;
export const WAD = 10n ** 18n;
export const USDC_ONE = 10n ** 6n;

// Scale factor for WAD×RAY→USDC conversion
const SCALE_TOK_RAY_TO_USDC = (WAD * RAY) / USDC_ONE;

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
  // Prefer timestamped path if supported and timestamp provided
  if (ts != null && oracle.submitNAV) {
    await oracle.submitNAV(navRay.toString(), ts, []); // updates timestamp
    return;
  }
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
    // fallback to submit without timestamp
    await oracle.submitNAV(navRay.toString(), ts ?? (await now()), []);
    return;
  }
}

// Token (WAD) -> USDC using NAV ray (1e27)
export function tokensToUSDC(tokenAmountWad: bigint, navRay: bigint): bigint {
  // token WAD * price(RAY) -> scale to USDC (1e6)
  // amountUSDC = round((token * nav) / (WAD * RAY / USDC_ONE)) = round(token * nav / 1e39)
  const num = tokenAmountWad * navRay;         // up to 1e45
  return divRoundHalfUp(num, SCALE_TOK_RAY_TO_USDC);
}

// Alias for consistency with requirements
export function toUSDCfromTokens(tokens: bigint, navRay: bigint): bigint {
  return tokensToUSDC(tokens, navRay);
}

// USDC -> Token (WAD) using NAV ray (1e27)
export function usdcToTokens(usdcAmount: bigint, navRay: bigint): bigint {
  // inverse of above: token = round(USDC * SCALE_TOK_RAY_TO_USDC / nav)
  const num = usdcAmount * SCALE_TOK_RAY_TO_USDC;
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
  await time.increaseTo(next);
}
