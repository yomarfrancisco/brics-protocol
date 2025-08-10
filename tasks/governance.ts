import { task } from "hardhat/config";

task("gov:attest", "Attest supermajority yesBps")
  .addParam("bps", "yes bps (0..10000)")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const tm = await hre.ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
    await (await (tm as any).attestSupermajority(Number(args.bps))).wait();
    console.log("Attested yesBps:", args.bps);
  });

task("gov:enforceSoftCap", "Enforce 105% soft-cap expiry and revert hi")
  .addParam("reverthi", "hi to revert to (e.g., 10300)")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const tm = await hre.ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
    await (await (tm as any).enforceSoftCapExpiry(Number(args.reverthi))).wait();
    console.log("Soft-cap expiry enforced, hi=", args.reverthi);
  });

task("controller:setDailyCap", "Set per-address daily issuance cap")
  .addParam("cap", "new cap in wei (BRICS decimals)")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const c = await hre.ethers.getContractAt("IssuanceControllerV3", s.issuance.IssuanceControllerV3);
    await (await (c as any).setDailyIssueCap(args.cap)).wait();
    console.log("Daily issuance cap set:", args.cap);
  });

task("controller:setRedeemCooldown", "Set base redeem cooldown seconds")
  .addParam("seconds", "seconds")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const c = await hre.ethers.getContractAt("IssuanceControllerV3", s.issuance.IssuanceControllerV3);
    await (await (c as any).setRedeemCooldown(Number(args.seconds))).wait();
    console.log("Redeem cooldown set:", args.seconds);
  });
