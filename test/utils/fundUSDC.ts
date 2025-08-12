import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

// Minimal IERC20 interface
const IERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Optional mint interface for MockUSDC (mintable in local tests)
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
  // We keep it simple: rely on presence of USDC_WHALE specifically, caller controls it.
  return !!process.env.USDC_WHALE;
}

export async function fundUsdcMintable(usdc: Contract, recipients: AddressLike[], amount: number | bigint) {
  // Fast path for local tests using MockUSDC: call mint directly.
  // NOTE: this assumes contracts/mocks/MockUSDC.sol which exposes mint(address,uint256).
  const minter = (await ethers.getSigners())[0];
  const amt = BigInt(amount);
  for (const who of recipients) {
    const addr = await toAddr(who);
    const tx = await usdc.connect(minter).mint(addr, amt);
    await tx.wait();
  }
}

export async function fundUsdcFromWhale(usdc: Contract, recipients: AddressLike[], amount: number | bigint) {
  // Whale route for forked mainnet testing. Only run if USDC_WHALE is provided.
  const whale = process.env.USDC_WHALE;
  if (!whale) {
    throw new Error("fundUsdcFromWhale: USDC_WHALE unset; set an address with ample USDC on the fork.");
  }
  const signer: Signer = await ethers.getImpersonatedSigner(whale);
  const amt = BigInt(amount);
  for (const who of recipients) {
    const addr = await toAddr(who);
    const tx = await usdc.connect(signer).transfer(addr, amt);
    await tx.wait();
  }
}

/**
 * Unified USDC funding helper.
 * - On local/mock: uses mintable path (MockUSDC).
 * - On fork: uses USDC_WHALE, if provided.
 * - Throws if fork path requested but no whale provided.
 */
export async function fundUSDC(usdc: Contract, recipients: AddressLike[], opts?: { amount?: number | bigint, forceMint?: boolean }) {
  const amount = opts?.amount ?? 1_000_000n * 10n ** 6n; // 1,000,000 USDC default (6 decimals)
  if (opts?.forceMint === true) {
    return fundUsdcMintable(usdc, recipients, amount);
  }
  if (isForkRuntime()) {
    return fundUsdcFromWhale(usdc, recipients, amount);
  }
  return fundUsdcMintable(usdc, recipients, amount);
}
