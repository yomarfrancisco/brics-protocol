import { ethers } from "hardhat";

export const USDC = (x: string | number | bigint) => {
  const s = typeof x === "string" ? x : x.toString();
  return ethers.parseUnits(s.replace(/_/g, ""), 6);
};

export const expectNonZero = (val: bigint) => { 
  if (val === 0n) throw new Error("amount=0"); 
  return val; 
};
