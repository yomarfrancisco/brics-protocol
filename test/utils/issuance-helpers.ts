import { tokensOut } from "./nav-math";

export const expectedTokens = (usdcAmt: bigint, navRay: bigint, rateBps: bigint) => {
  const base = tokensOut(usdcAmt, navRay); // (usdc * 1e27) / navRay
  return rateBps >= 10000n ? base : (base * rateBps) / 10000n;
};

export const readIssuanceRateBps = async (cfg: any): Promise<bigint> => {
  const p = await cfg.getCurrentParams(); // struct with maxIssuanceRateBps
  return BigInt(p.maxIssuanceRateBps ?? p[0]); // fallback to first field if tuple
};

export const setIssuanceRateBps = async (cfg: any, bps: bigint) => {
  if (cfg.setMaxIssuanceRateBps) {
    return cfg.setMaxIssuanceRateBps(bps);
  }
  // If not supported, skip silently - tests will read the live rate
};
