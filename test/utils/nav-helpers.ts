import { ethers } from "hardhat";

export const RAY = 10n ** 27n;

export async function getNavRayCompat(oracle: any): Promise<bigint> {
  if (oracle.navRay) return BigInt(await oracle.navRay());
  if (oracle.latestNAVRay) return BigInt(await oracle.latestNAVRay());
  if (oracle.getNavRay) return BigInt(await oracle.getNavRay());
  throw new Error("No NAV getter on oracle");
}

export async function setNavCompat(oracle: any, navRay: bigint) {
  if (oracle.setNavRay) return oracle.setNavRay(navRay);
  if (oracle.setNAV)    return oracle.setNAV(navRay / (10n ** 9n)); // legacy 1e18 (if present)
  throw new Error("No NAV setter on oracle");
}
