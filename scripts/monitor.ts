import { ethers } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const s = JSON.parse(readFileSync(path, "utf-8"));

  const cfg = await ethers.getContractAt("ConfigRegistry", s.core.ConfigRegistry);
  const tm = await ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
  const oracle = await ethers.getContractAt("NAVOracleV3", s.oracle.NAVOracleV3);
  const pre = await ethers.getContractAt("PreTrancheBuffer", s.finance.PreTrancheBuffer);

  console.log("Monitoring started on", hre.network.name);

  (cfg as any).on("EmergencyLevelSet", (level: number, reason: string) => {
    console.log("[ALERT] Emergency level:", level, reason);
  });
  (tm as any).on("DetachmentRaised", (lo: number, hi: number) => {
    console.log("[EVENT] Detachment raised:", lo, hi);
  });
  (tm as any).on("SoftCapExpanded", (hi: number, reason: string, expiry: bigint) => {
    console.log("[EVENT] SoftCap expanded:", hi, reason, new Date(Number(expiry) * 1000).toISOString());
  });
  (pre as any).on("InstantRedemption", (user: string, amount: bigint) => {
    console.log("[EVENT] Instant redemption:", user, amount.toString());
  });

  // periodic poll
  setInterval(async () => {
    const [nav, lastTs, buf] = await Promise.all([
      (oracle as any).navRay(),
      (oracle as any).lastTs(),
      (pre as any).bufferBalance(),
    ]);
    console.log("NAV:", nav.toString(), "lastTs:", Number(lastTs), "buffer:", buf.toString());
  }, 10000);
}

main().catch((e) => { console.error(e); process.exit(1); });
