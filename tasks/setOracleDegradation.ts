import { task } from "hardhat/config";
task("oracle:degradation", "Toggle degradation mode")
  .addParam("enabled", "true/false")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const oracle = await hre.ethers.getContractAt("NAVOracleV3", s.oracle.NAVOracleV3);
    await (await oracle.toggleDegradationMode(args.enabled === "true")).wait();
    console.log("Degradation:", args.enabled);
  });
