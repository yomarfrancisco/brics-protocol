import { ethers } from "hardhat";

export const RAY = 10n ** 27n;
export const USDC_DEC = 10n ** 6n;
export const BRICS_DEC = 10n ** 18n;

// Contract formulas (do not change here — mirror prod code):
export const tokensOut = (usdcAmt: bigint, navRay: bigint) =>
  (usdcAmt * RAY) / navRay; // (1e27) / navRay

export const usdcOutFromTokens = (tokenAmt: bigint, navRay: bigint) =>
  (tokenAmt * navRay) / (10n ** 30n); // /1e30

// NAV to make 1 USDC -> 1 BRICS with current formulas
// Solve 1e18 = (1e6 * 1e27) / nav -> nav = 1e15
export const navRayFor1to1 = 10n ** 15n;

// Helper: compute expected tokens for a human USDC string
export const USDC = (x: string | number | bigint) =>
  ethers.parseUnits(String(x).replace(/_/g, ""), 6);

/*
 * NAV Math Notes:
 * 
 * The contract formulas are NOT perfect inverses due to different denominators:
 * - mintFor: tokensOut = (usdcAmt * 1e27) / navRay
 * - _tokensToUSDC: usdcOut = (tokenAmt * navRay) / 1e30
 * 
 * This creates a 1e3 (1000x) scale difference in the conversion.
 * 
 * For 1 USDC (1e6) to mint exactly 1 BRICS (1e18):
 * 1e18 = (1e6 * 1e27) / navRay
 * navRay = (1e6 * 1e27) / 1e18 = 1e15
 * 
 * This means navRay = 1e15 represents "1.0" in a normalized scale where
 * 1 USDC = 1 BRICS token.
 */
