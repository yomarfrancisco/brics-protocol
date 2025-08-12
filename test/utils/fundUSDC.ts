import { ethers, network } from "hardhat";
import { Contract, Signer } from "ethers";

const USDC_DECIMALS = 6;

/** Detects mint capability by checking if the contract has a mint function. */
async function hasMint(token: Contract): Promise<boolean> {
  try {
    // Check if the contract has a mint function by looking at the interface
    const contractInterface = token.interface;
    const functions = Object.keys(contractInterface.functions);
    return functions.includes('mint(address,uint256)');
  } catch {
    return false;
  }
}

export async function fundUsdcMintable(
  token: Contract,
  recipients: (Signer | string)[],
  amountUnits = 1_000_000 // 1,000,000 USDC
) {
  const amount = BigInt(amountUnits) * BigInt(10 ** USDC_DECIMALS);
  
  // Find a signer that can mint (often deployer/governor).
  const [minter] = await ethers.getSigners();
  for (const rcpt of recipients) {
    const addr = typeof rcpt === "string" ? rcpt : await rcpt.getAddress();
    const tx = await token.connect(minter).mint(addr, amount);
    await tx.wait();
  }
}

/** Impersonates a whale/treasury and transfers USDC to recipients. */
export async function fundUsdcFromWhale(
  token: Contract,
  whaleAddress: string,
  recipients: (Signer | string)[],
  amountUnits = 1_000_000 // 1,000,000 USDC
) {
  if (!network.name.toLowerCase().includes("fork")) {
    throw new Error("Whale funding requires a forked network");
  }

  const amount = BigInt(amountUnits) * BigInt(10 ** USDC_DECIMALS);

  await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
  await ethers.provider.send("hardhat_setBalance", [
    whaleAddress,
    "0x1000000000000000000", // give whale ETH for gas
  ]);
  const whale = await ethers.getSigner(whaleAddress);

  for (const rcpt of recipients) {
    const addr = typeof rcpt === "string" ? rcpt : await rcpt.getAddress();
    const tx = await token.connect(whale).transfer(addr, amount);
    await tx.wait();
  }

  await ethers.provider.send("hardhat_stopImpersonatingAccount", [whaleAddress]);
}

/** Unified wrapper that tries mint first, else falls back to whale on forks */
export async function fundUSDC(
  token: Contract,
  recipients: (Signer | string)[],
  opts: { amount?: number; whale?: string } = {}
) {
  try {
    await fundUsdcMintable(token, recipients, opts.amount ?? 1_000_000);
    return;
  } catch {
    if (opts.whale) {
      await fundUsdcFromWhale(token, opts.whale, recipients, opts.amount ?? 1_000_000);
      return;
    }
    throw new Error("USDC funding failed: token not mintable and no whale provided");
  }
}
