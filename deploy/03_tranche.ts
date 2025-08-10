import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const DAO = process.env.DAO_MULTISIG || deployer.address;

  // BRICSToken
  const BRICSToken = await ethers.getContractFactory("BRICSToken");
  const brics = await BRICSToken.deploy(DAO, state.core.MemberRegistry);
  await brics.waitForDeployment();

  // SovereignClaimToken (SA)
  const SovereignClaimToken = await ethers.getContractFactory("SovereignClaimToken");
  const sbtSA = await SovereignClaimToken.deploy(DAO);
  await sbtSA.waitForDeployment();

  // TrancheManagerV2 wired to oracle
  if (!state.oracle || !state.oracle.NAVOracleV3) {
    throw new Error("Oracle not found in state. Ensure 04_oracle.ts ran before 03_tranche.ts");
  }
  const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
  const tm = await TrancheManagerV2.deploy(
    DAO,
    state.oracle.NAVOracleV3,
    state.core.ConfigRegistry
  );
  await tm.waitForDeployment();

  state.tranche = {
    BRICSToken: await brics.getAddress(),
    SovereignClaimToken_SA: await sbtSA.getAddress(),
    TrancheManagerV2: await tm.getAddress()
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Tranche deployed:", state.tranche);
}
main().catch((e) => { console.error(e); process.exit(1); });
