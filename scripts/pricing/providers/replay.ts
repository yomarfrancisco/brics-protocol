import { readFileSync } from "fs";
import { join } from "path";
import type { QuoteInput, QuoteOut } from "./types";

const FIXTURES_DIR = process.env.PRICING_FIXTURES_DIR || "pricing-fixtures";

export async function quoteReplay(input: QuoteInput): Promise<QuoteOut> {
  // key by obligorId + tenor + asOf for determinism
  const key = `${input.obligorId}-${input.tenorDays}-${input.asOf}.json`;
  const p = join(FIXTURES_DIR, key);
  const data = JSON.parse(readFileSync(p, "utf8"));
  return {
    fairSpreadBps: data.fairSpreadBps,
    correlationBps: data.correlationBps,
    asOf: data.asOf,
    riskScore: data.riskScore,
    modelIdHash: data.modelIdHash,
    featuresHash: data.featuresHash,
    digest: data.digest,
    signature: data.signature,
    signer: data.signer
  };
}
