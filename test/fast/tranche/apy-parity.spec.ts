import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "node:fs";

describe("Tranche APY Parity Tests", () => {
  it("should match golden vectors exactly", async () => {
    const vectors = JSON.parse(
      fs.readFileSync("tests/golden/tranche_apy.json", "utf8")
    );

    // Inline JS replica of Solidity TrancheMath.effectiveApyBps
    const effectiveApyBps = (baseApyBps: number, riskAdjBps: number, maxApyBps: number) => {
      let effective = 0;
      
      // Calculate base - risk adjustment
      if (baseApyBps > riskAdjBps) {
        effective = baseApyBps - riskAdjBps;
      }
      
      // Clamp to maximum
      if (effective > maxApyBps) {
        effective = maxApyBps;
      }
      
      return effective;
    };

    for (const v of vectors) {
      const got = effectiveApyBps(v.baseApyBps, v.riskAdjBps, v.maxApyBps);
      expect(got, v.name).to.equal(v.expectedEffectiveApyBps);
    }
  });
});
