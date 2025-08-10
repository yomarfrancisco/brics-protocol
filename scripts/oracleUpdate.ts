import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));
  const oracle = await ethers.getContractAt("NAVOracleV3", state.oracle.NAVOracleV3);

  const now = Math.floor(Date.now() / 1000);
  const navRay = ethers.parseUnits(process.env.NAV_RAY || "1", 27);

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    const tx = await (oracle as any).devSeedNAV(navRay, now);
    await tx.wait();
    console.log("Dev NAV seeded:", navRay.toString(), now);
    return;
  }

  // Placeholder for signed update flow (XGBoost/AI signer service)
  // Expect a list of signatures from off-chain signers to meet quorum
  const ts = now;
  const nonce = Number(process.env.NAV_NONCE || 1);
  const sigs: string[] = []; // TODO: load from signer service

  const tx = await (oracle as any).setNAV(navRay, ts, nonce, sigs);
  await tx.wait();
  console.log("NAV set:", navRay.toString(), ts, nonce);
}

main().catch((e) => { console.error(e); process.exit(1); });
