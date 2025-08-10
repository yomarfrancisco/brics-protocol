import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const ECC = process.env.ECC_MULTISIG || deployer.address;

  // NAVOracleV3
  const NAVOracleV3 = await ethers.getContractFactory("NAVOracleV3");
  const oracle = await NAVOracleV3.deploy(ECC, process.env.MODEL_HASH || ethers.id("model-v1"));
  await oracle.waitForDeployment();

  // Set model signers & emergency signers
  const modelSigners: string[] = state.env?.MODEL_SIGNERS || [];
  for (const s of modelSigners) {
    if (s) {
      await (await (oracle as any).setSigner(s, true)).wait();
    }
  }
  const emergencySigners: string[] = state.env?.EMERGENCY_SIGNERS || [];
  for (const s of emergencySigners) {
    if (s) {
      await (await (oracle as any).setEmergencySigner(s, true)).wait();
    }
  }
  await (await (oracle as any).setQuorum(3)).wait();

  // Dev bootstrap NAV on local networks
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    const now = Math.floor(Date.now() / 1000);
    await (await (oracle as any).devSeedNAV(ethers.parseUnits("1", 27), now)).wait();
  }

  state.oracle = { NAVOracleV3: await oracle.getAddress() };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Oracle deployed:", state.oracle);
}
main().catch((e) => { console.error(e); process.exit(1); });
