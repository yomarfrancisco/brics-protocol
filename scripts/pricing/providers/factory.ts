import { PricingProvider, QuoteInput, QuoteOut } from "./types";
import crypto from "crypto";
import fs from "fs";
import { quoteReplay } from "./replay";

const env = (k: string, d?: string) => (process.env[k] ?? d ?? "").trim();
const PROVIDER = env("PRICING_PROVIDER", "stub");        // stub|fastapi|replay|bank
const BANK_MODE = env("BANK_DATA_MODE", "off");          // off|record|replay|live
const STUB_SIGN = env("STUB_SIGN", "0") === "1";         // 0|1 (default 0)
const RISK_ORACLE_PRIVATE_KEY = env("RISK_ORACLE_PRIVATE_KEY", "0x000000000000000000000000000000000000000000000000000000000000002a"); // 32-byte dev key

// Log provider selection once
console.log(`🔧 Pricing provider: ${PROVIDER}, Bank mode: ${BANK_MODE}`);

export class PricingProviderStub implements PricingProvider {
  async price(input: QuoteInput): Promise<QuoteOut> {
    // deterministic "golden" response (keccak over a few fields)
    // Use the portfolioId as-is (it should already be bytes32 format)
    const hashInput = JSON.stringify({ p: input.portfolioId, t: input.tenorDays, a: input.asOf });
    console.log("🔍 Stub provider hash input:", hashInput);
    const h = crypto.createHash("sha256")
      .update(hashInput)
      .digest();
    const fair = 25 + (h[0] % 100);          // 25..124 bps
    const corr = 1000 + (h[1] % 8000);       // 10%..90%
    
    let digest: string;
    let signature: string;
    let signer: string;
    
    if (STUB_SIGN) {
      // Generate real signature using private key
      const { ethers } = await import("ethers");
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      
      // Ensure portfolioId is properly formatted as bytes32
      const portfolioIdBytes32 = ethers.zeroPadValue(input.portfolioId, 32);
      
      // Create deterministic values for the new fields
      const riskScore = 1000 + (h[2] % 9000); // 1000-9999
      const modelIdHash = ethers.keccak256(ethers.toUtf8Bytes("baseline-v0"));
      const featuresHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(input.features)));
      
      digest = ethers.keccak256(abiCoder.encode(
        ["bytes32", "uint64", "uint256", "uint16", "uint16", "bytes32", "bytes32"],
        [portfolioIdBytes32, input.asOf, riskScore, corr, fair, modelIdHash, featuresHash]
      ));
      
      const wallet = new ethers.Wallet(RISK_ORACLE_PRIVATE_KEY);
      // Sign the raw digest (RiskSignalLib.recoverSigner will apply EIP-191 prefix)
      signature = await wallet.signMessage(ethers.getBytes(digest));
      signer = wallet.address;
    } else {
      // Placeholder signature (verification expected to fail)
      digest = "0x" + Buffer.alloc(32).toString("hex");
      signature = "0x" + Buffer.alloc(65).toString("hex");
      signer = "0x" + Buffer.alloc(20).toString("hex");
    }
    
    if (STUB_SIGN) {
      const { ethers } = await import("ethers");
      return {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf: input.asOf,
        riskScore: 1000 + (h[2] % 9000),
        modelIdHash: ethers.keccak256(ethers.toUtf8Bytes("baseline-v0")),
        featuresHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(input.features))),
        digest,
        signature,
        signer,
      };
    } else {
      return {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf: input.asOf,
        riskScore: 0,
        modelIdHash: "0x" + Buffer.alloc(32).toString("hex"),
        featuresHash: "0x" + Buffer.alloc(32).toString("hex"),
        digest,
        signature,
        signer,
      };
    }
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
      console.log(`Bank provider blocked: BANK_DATA_MODE=${BANK_MODE} (requires BANK_DATA_MODE=live)`);
      throw new Error(`Bank provider disabled (BANK_DATA_MODE=${BANK_MODE}). Set BANK_DATA_MODE=live to enable.`);
    }
    // TODO: real impl later
    throw new Error("Bank provider not implemented yet.");
  }
}

export class PricingProviderReplay implements PricingProvider {
  async price(input: QuoteInput): Promise<QuoteOut> {
    return quoteReplay(input);
  }
}

export function makePricingProvider(): PricingProvider {
  switch (PROVIDER) {
    case "fastapi": return new PricingProviderFastAPI();
    case "replay":  return new PricingProviderReplay();
    case "bank":    return new PricingProviderBank();
    case "stub":
    default:        return new PricingProviderStub();
  }
}
