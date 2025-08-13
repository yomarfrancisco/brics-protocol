import { expect } from "chai";
import fs from "node:fs";

describe("Settlement parity (golden vectors)", () => {
  it("matches JSON golden vectors", async () => {
    const vectors = JSON.parse(
      fs.readFileSync("pricing_service/tests/golden/settlement_vectors.json", "utf8")
    );

    // Inline JS replica of Solidity library until we expose it via a test wrapper
    const roundHalfUp = (numer: bigint, denom: bigint) =>
      numer >= 0n ? (numer + denom / 2n) / denom : -(((-numer) + denom / 2n) / denom);

    const compute = (fair: number, fixed: number, notional: number, elapsed: number, tenor: number) => {
      const delta = BigInt(fair - fixed);
      const n = delta * BigInt(notional) * BigInt(elapsed);
      const d = 10000n * BigInt(tenor);
      return Number(roundHalfUp(n, d));
    };

    for (const v of vectors) {
      const got = compute(v.fairSpreadBps, v.fixedSpreadBps, v.notional, v.elapsedDays, v.tenorDays);
      expect(got, v.name).to.equal(v.expectedPnlSmallest);
    }
  });
});
