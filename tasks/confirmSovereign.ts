import { task } from "hardhat/config";
task("sovereign:confirm", "Confirm sovereign guarantee")
  .addParam("confirmed", "true/false")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const tm = await hre.ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
    await (await tm.confirmSovereignGuarantee(args.confirmed === "true")).wait();
    console.log("Sovereign guarantee confirmed:", args.confirmed);
  });
