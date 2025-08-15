import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

// Minimal IERC20 interface
const IERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Optional mint interface for MockBRICSToken (mintable in local tests)
const IMintable_ABI = [
  "function mint(address,uint256) returns (bool)",
];

type AddressLike = string | { address: string } | Signer;
async function toAddr(x: AddressLike): Promise<string> {
  if (typeof x === "string") {
    return x;
  }
  if (typeof x === "object" && "address" in x) {
    return x.address;
  }
  if (typeof x === "object" && "getAddress" in x) {
    return await x.getAddress();
  }
  throw new Error(`Invalid address: ${x}`);
}

function isForkRuntime(): boolean {
  // Heuristic: mainnet fork usually has a non-default chainId and process.env.ALCHEMY/INFURA set.
  // We keep it simple: rely on presence of BRICS_WHALE specifically, caller controls it.
  return !!process.env.BRICS_WHALE;
}

export async function fundBricsMintable(brics: Contract, recipients: AddressLike[], amount: number | bigint) {
  // Fast path for local tests using MockBRICSToken: call mint directly.
  // NOTE: this assumes contracts/mocks/MockBRICSToken.sol which exposes mint(address,uint256).
  const minter = (await ethers.getSigners())[0];
  const amt = BigInt(amount);
  
  // Distribute the total amount equally among recipients
  const amountPerRecipient = amt / BigInt(recipients.length);
  const remainder = amt % BigInt(recipients.length);
  
  for (let i = 0; i < recipients.length; i++) {
    const who = recipients[i];
    const addr = await toAddr(who);
    const recipientAmount = amountPerRecipient + (i === 0 ? remainder : 0n); // Give remainder to first recipient
    const tx = await brics.connect(minter).mint(addr, recipientAmount);
    await tx.wait();
  }
}

export async function fundBricsFromWhale(brics: Contract, recipients: AddressLike[], amount: number | bigint) {
  // Whale route for forked mainnet testing. Only run if BRICS_WHALE is provided.
  const whale = process.env.BRICS_WHALE;
  if (!whale) {
    throw new Error("fundBricsFromWhale: BRICS_WHALE unset; set an address with ample BRICS on the fork.");
  }
  const signer: Signer = await ethers.getImpersonatedSigner(whale);
  const amt = BigInt(amount);
  
  // Distribute the total amount equally among recipients
  const amountPerRecipient = amt / BigInt(recipients.length);
  const remainder = amt % BigInt(recipients.length);
  
  for (let i = 0; i < recipients.length; i++) {
    const who = recipients[i];
    const addr = await toAddr(who);
    const recipientAmount = amountPerRecipient + (i === 0 ? remainder : 0n); // Give remainder to first recipient
    const tx = await brics.connect(signer).transfer(addr, recipientAmount);
    await tx.wait();
  }
}

/**
 * Unified BRICS token funding helper.
 * - On local/mock: uses mintable path (MockBRICSToken).
 * - On fork: uses BRICS_WHALE, if provided.
 * - Throws if fork path requested but no whale provided.
 */
export async function fundBRICS(brics: Contract, recipients: AddressLike[], opts?: { amount?: number | bigint, forceMint?: boolean }) {
  const amount = opts?.amount ?? 1_000_000n * 10n ** 18n; // 1,000,000 BRICS default (18 decimals)
  if (opts?.forceMint === true) {
    return fundBricsMintable(brics, recipients, amount);
  }
  if (isForkRuntime()) {
    return fundBricsFromWhale(brics, recipients, amount);
  }
  return fundBricsMintable(brics, recipients, amount);
}
