import { time } from "@nomicfoundation/hardhat-network-helpers";

/** Jumps forward in time but never backwards. Accepts number or bigint. */
export async function safeIncreaseTo(targetTs: number | bigint): Promise<void> {
  const latest = await time.latest();
  const next = Number(targetTs);
  await time.increaseTo(Math.max(next, latest + 1));
}

/** Convenience: returns a strictly-forward "now" as bigint. */
export async function safeNow(provider: any): Promise<bigint> {
  const latest = await time.latest();
  await time.increaseTo(latest + 1);
  return BigInt(latest + 1);
}
