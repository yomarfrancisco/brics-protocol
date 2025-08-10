import { task } from "hardhat/config";

task("tranche:emergencyExpand", "Emergency expand to 105% soft-cap (ECC only)")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const tm = await hre.ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
    await (await (tm as any).emergencyExpandToSoftCap()).wait();
    console.log("Emergency expanded to 105% soft-cap");
  });

