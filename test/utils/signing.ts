import { ethers } from "ethers";

/** Bytes -> EIP-191 digest (same as MessageHashUtils.toEthSignedMessageHash) */
export function toEthSignedMessageHash(msgBytes: Uint8Array): string {
  return ethers.hashMessage(msgBytes); // adds the \x19Ethereum Signed Message:\n prefix
}

/** Sign EIP-191-prefixed digest (bytes) with a Signer */
export async function signBytesEip191(signer: ethers.Signer, msgBytes: Uint8Array): Promise<string> {
  // Option A: use signMessage on raw bytes (ethers adds EIP-191)
  return await signer.signMessage(msgBytes);
}

/** Verify like the contract: recover from EIP-191-prefixed digest */
export function recoverEip191(msgBytes: Uint8Array, sig: string): string {
  // ethers.verifyMessage takes raw bytes and expects EIP-191 signature
  return ethers.verifyMessage(msgBytes, sig);
}

/** Sign a digest (bytes32) with EIP-191 prefix - for RiskSignalLib compatibility */
export async function signDigestEip191(signer: ethers.Signer, digest: string): Promise<string> {
  const msgBytes = ethers.getBytes(digest);
  return await signBytesEip191(signer, msgBytes);
}

/** Verify a digest signature - for RiskSignalLib compatibility */
export function verifyDigestEip191(digest: string, sig: string): string {
  const msgBytes = ethers.getBytes(digest);
  return recoverEip191(msgBytes, sig);
}
