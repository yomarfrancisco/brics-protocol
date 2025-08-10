import { task } from "hardhat/config";
task("tranche:raise", "Raise detachment by +100bps (or to 105% in RED with confirm)")
  .addParam("lo", "new lower (bps*100)")
  .addParam("hi", "new upper (bps*100)")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const tm = await hre.ethers.getContractAt("TrancheManagerV2", s.tranche.TrancheManagerV2);
    await (await tm.raiseBRICSDetachment(Number(args.lo), Number(args.hi))).wait();
    console.log("Detachment raised to:", args.lo, args.hi);
  });
