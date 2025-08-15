import { BigNumberish } from "ethers";

/**
 * Returns the effective capacity in **token-18** units (BRICS),
 * applying utilization cap and haircut to the sovereign softCap.
 *
 * softCapTokens: BigNumberish (18-dec tokens)
 * utilCapBps: 0..10000
 * haircutBps: 0..10000
 */
export function calcEffectiveCapTokens(
  softCapTokens: BigNumberish,
  utilCapBps: BigNumberish,
  haircutBps: BigNumberish
): bigint {
  const soft = BigInt(softCapTokens);
  const util = BigInt(utilCapBps);
  const haircut = BigInt(haircutBps);

  // effectiveBps = utilCapBps * (10000 - haircutBps) / 10000
  const effectiveBps = (util * (10_000n - haircut)) / 10_000n;

  // capTokens = softCapTokens * effectiveBps / 10000
  return (soft * effectiveBps) / 10_000n;
}
