import { ethers, Wallet } from "ethers";

// Canonical Anvil/Hardhat dev pk (addr 0xf39F...)
// Used only if CI secret isn't present.
const FALLBACK_CI_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export function getCiSignerPrivateKey(): string {
  const pk = process.env.CI_SIGNER_PRIVKEY?.trim();
  return pk && pk.startsWith("0x") && pk.length === 66 ? pk : FALLBACK_CI_PK;
}

export function getCiSignerWallet(): Wallet {
  return new Wallet(getCiSignerPrivateKey(), (global as any).ethers?.provider ?? undefined);
}

export function getCiSignerAddress(): string {
  return new Wallet(getCiSignerPrivateKey()).address;
}
