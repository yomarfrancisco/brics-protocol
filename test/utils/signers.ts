import { ethers, Wallet } from "ethers";

// Canonical Hardhat/Anvil #0
const FALLBACK_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function isHex32(s?: string | null) {
  return !!s && /^0x[0-9a-fA-F]{64}$/.test(s.trim());
}

/** Single source of truth for CI signer private key. */
export function getCiSignerPrivateKey(): string {
  // Secrets can appear as "[REDACTED]" or empty in logs; validate strictly.
  const raw = (process.env.CI_SIGNER_PRIVKEY ?? "").trim();
  return isHex32(raw) ? raw : FALLBACK_PK;
}

export function getCiSignerWallet(): Wallet {
  // Provider from the hardhat runtime if present; undefined is ok for signMessage.
  const provider: any = (global as any).ethers?.provider ?? undefined;
  return new Wallet(getCiSignerPrivateKey(), provider);
}

export function getCiSignerAddress(): string {
  return new Wallet(getCiSignerPrivateKey()).address;
}
