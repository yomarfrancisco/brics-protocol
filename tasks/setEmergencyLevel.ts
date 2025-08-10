import { task } from "hardhat/config";
task("set:level", "Set emergency level")
  .addParam("level", "0 NORMAL, 1 YELLOW, 2 ORANGE, 3 RED")
  .addParam("reason", "reason")
  .setAction(async (args, hre) => {
    const cfg = await hre.ethers.getContractAt("ConfigRegistry", (await import(`../deployments-${hre.network.name}.json`)).core.ConfigRegistry);
    await (await cfg.setEmergencyLevel(Number(args.level), args.reason)).wait();
    console.log("Emergency level set:", args.level);
  });
