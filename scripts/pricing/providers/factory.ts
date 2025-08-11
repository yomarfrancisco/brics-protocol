import { PricingProvider, QuoteInput, QuoteOut } from "./types";
import crypto from "crypto";
import fs from "fs";

const env = (k: string, d?: string) => (process.env[k] ?? d ?? "").trim();
const PROVIDER = env("PRICING_PROVIDER", "stub");        // stub|fastapi|replay|bank
const BANK_MODE = env("BANK_DATA_MODE", "off");          // off|record|replay|live

export class PricingProviderStub implements PricingProvider {
  async price(input: QuoteInput): Promise<QuoteOut> {
    // deterministic "golden" response (keccak over a few fields)
    const h = crypto.createHash("sha256")
      .update(JSON.stringify({ p: input.portfolioId, t: input.tenorDays, a: input.asOf }))
      .digest();
    const fair = 25 + (h[0] % 100);          // 25..124 bps
    const corr = 1000 + (h[1] % 8000);       // 10%..90%
    // digest/signature placeholders (swap.demo will still verify on-chain format if you prefer)
    return {
      fairSpreadBps: fair,
      correlationBps: corr,
      digest: "0x" + Buffer.alloc(32).toString("hex"),
      signature: "0x" + Buffer.alloc(65).toString("hex"),
      signer: "0x" + Buffer.alloc(20).toString("hex"),
      asOf: input.asOf,
    };
  }
}

export class PricingProviderFastAPI implements PricingProvider {
  constructor(private url = env("PRICING_URL", "http://127.0.0.1:8001")) {}
  async price(input: QuoteInput): Promise<QuoteOut> {
    const res = await fetch(`${this.url}/v1/price`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        obligorId: input.portfolioId,         // or pass raw obligorId separately if you keep both
        tenorDays: input.tenorDays,
        asOf: input.asOf,
        notional: Number(input.notional),
        modelId: input.modelId ?? "baseline-v0",
        features: input.features,
        couponHintBps: input.fixedSpreadBps,
      }),
    });
    if (!res.ok) throw new Error(`pricing http ${res.status}`);
    return (await res.json()) as QuoteOut;
  }
}

export class PricingProviderRecordReplay implements PricingProvider {
  constructor(private dir = env("PRICING_FIXTURES_DIR", "pricing-fixtures")) {}
  private key(i: QuoteInput) {
    return `${i.portfolioId}_${i.tenorDays}_${i.asOf}_${i.notional}`;
  }
  async price(i: QuoteInput): Promise<QuoteOut> {
    const k = this.key(i);
    const path = `${this.dir}/${k}.json`;
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, "utf8"));
    // delegate to stub to produce deterministic vector, save for parity
    const q = await new PricingProviderStub().price(i);
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path, JSON.stringify(q, null, 2));
    return q;
  }
}

export class PricingProviderBank implements PricingProvider {
  async price(): Promise<QuoteOut> {
    if (BANK_MODE !== "live") {
      throw new Error(`Bank provider disabled (BANK_DATA_MODE=${BANK_MODE}). Set BANK_DATA_MODE=live to enable.`);
    }
    // TODO: real impl later
    throw new Error("Bank provider not implemented yet.");
  }
}

export function makePricingProvider(): PricingProvider {
  switch (PROVIDER) {
    case "fastapi": return new PricingProviderFastAPI();
    case "replay":  return new PricingProviderRecordReplay();
    case "bank":    return new PricingProviderBank();
    case "stub":
    default:        return new PricingProviderStub();
  }
}
