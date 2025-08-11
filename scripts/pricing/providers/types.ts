export type QuoteInput = {
  portfolioId: string;            // hex 0x…32 or will be keccak(obligorId)
  tenorDays: number;
  asOf: number;
  notional: bigint;
  features: Record<string, number>;
  fixedSpreadBps?: number;
  modelId?: string;               // e.g. "baseline-v0"
};

export type QuoteOut = {
  fairSpreadBps: number;
  correlationBps: number;
  digest: string;     // 0x…32
  signature: string;  // 0x…65
  signer: string;     // 0x…40
  asOf: number;
};

export interface PricingProvider { 
  price(input: QuoteInput): Promise<QuoteOut>; 
}
