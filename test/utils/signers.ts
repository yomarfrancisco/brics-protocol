import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "ethers";

/**
 * Get the CI signer for deterministic testing
 * 
 * In CI: uses CI_SIGNER_PRIVKEY from environment
 * In dev: uses a fixed test key for consistent local development
 * 
 * @param hre Hardhat runtime environment (optional)
 * @returns Signer instance for deterministic signing
 */
export function getCiSigner(hre?: HardhatRuntimeEnvironment) {
  // In CI, use the environment variable
  if (process.env.CI_SIGNER_PRIVKEY) {
    return new ethers.Wallet(process.env.CI_SIGNER_PRIVKEY);
  }
  
  // In development, use a fixed test key for consistency
  // This key is for testing only - never use in production
  const DEV_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  return new ethers.Wallet(DEV_TEST_KEY);
}

/**
 * Get the CI signer address
 * @param hre Hardhat runtime environment (optional)
 * @returns Address of the CI signer
 */
export function getCiSignerAddress(hre?: HardhatRuntimeEnvironment): string {
  return getCiSigner(hre).address;
}

/**
 * Get the CI signer wallet with provider
 * @returns Wallet instance with provider for EIP-712 signing
 */
export function getCiSignerWallet(): Wallet {
  const pk =
    process.env.CI_SIGNER_PRIVKEY ??
    // fall back to the canonical Anvil/Hardhat dev key (addr 0xf39F…)
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  return new Wallet(pk, ethers.provider);
}
