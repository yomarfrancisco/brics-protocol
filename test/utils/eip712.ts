import { ethers } from "hardhat";

export const EIP712_NAME = "BRICS_ISSUANCE";
export const EIP712_VERSION = "1" as const;

const types = {
  MintIntent: [
    { name: "to",             type: "address"  },
    { name: "usdcAmt",        type: "uint256"  },
    { name: "tailCorrPpm",    type: "uint256"  },
    { name: "sovUtilBps",     type: "uint256"  },
    { name: "sovereignCode",  type: "bytes32"  },
    { name: "nonce",          type: "uint256"  },
    { name: "deadline",       type: "uint256"  },
    { name: "chainId",        type: "uint256"  },
  ],
} as const;

export async function signMintIntent(
  signer: any,                  // ethers.Signer
  controllerAddr: string,
  chainIdBig: bigint,
  to: string,
  usdcAmt: bigint,
  tailCorrPpm: bigint,
  sovUtilBps: bigint,
  sovereignCode: string,        // bytes32 string or 0x…32
  nonce: bigint,
  deadline: bigint
): Promise<string> {
  const domain = {
    name: EIP712_NAME,
    version: EIP712_VERSION,
    chainId: chainIdBig,
    verifyingContract: controllerAddr,
  };
  const value = {
    to,
    usdcAmt,
    tailCorrPpm,
    sovUtilBps,
    sovereignCode,
    nonce,
    deadline,
    chainId: chainIdBig, // NOTE: contract also encodes chainId in the struct itself
  };
  // ethers v6
  return await signer.signTypedData(domain as any, types as any, value as any);
}
