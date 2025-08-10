import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  const path = `deployments-localhost.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const dao = process.env.DAO_MULTISIG || deployer.address;

  const registry = await ethers.getContractAt("MemberRegistry", state.core.MemberRegistry);
  const oa = await ethers.getContractAt("OperationalAgreement", state.core.OperationalAgreement);
  const usdc = await ethers.getContractAt("MockUSDC", state.finance.USDC);
  const controller = await ethers.getContractAt("IssuanceControllerV3", state.issuance.IssuanceControllerV3);
  const token = await ethers.getContractAt("BRICSToken", state.tranche.BRICSToken);

  // Approve deployer as member if not already
  const isMember: boolean = await registry.isMember(deployer.address);
  if (!isMember) {
    await (await oa.approveMember(deployer.address)).wait();
    console.log("Member approved:", deployer.address);
  }

  // Approve USDC allowance to controller
  const amountUSDC = ethers.parseUnits("1000", 6);
  await (await usdc.approve(await controller.getAddress(), amountUSDC)).wait();
  console.log("USDC allowance set for controller:", amountUSDC.toString());

  // Mint BRICS to deployer via controller (OPS_ROLE is assigned to gov in constructor)
  const tailCorrPpm = 0;
  const sovUtilBps = 0;
  const tx = await controller.mintFor(deployer.address, amountUSDC, tailCorrPpm, sovUtilBps);
  const rc = await tx.wait();
  console.log("Mint tx:", rc?.hash);

  // Check BRICS balance
  const bal = await token.balanceOf(deployer.address);
  console.log("BRICS balance:", bal.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
