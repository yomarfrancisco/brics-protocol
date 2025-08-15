import { time } from "@nomicfoundation/hardhat-network-helpers";

/** Jumps forward in time but never backwards. Accepts number or bigint. */
export async function safeIncreaseTo(targetTs: number | bigint) {
  const latest = await time.latest();
  const next = Number(typeof targetTs === "bigint" ? targetTs : targetTs);
  await time.increaseTo(Math.max(next, latest + 1));
}

/** Convenience: returns a strictly-forward "now" usable for comparisons. */
export async function safeNow(): Promise<number> {
  const latest = await time.latest();
  await time.increaseTo(latest + 1);
  return latest + 1;
}
