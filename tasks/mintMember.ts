import { task } from "hardhat/config";
task("member:approve", "Approve a member in registry via OperationalAgreement")
  .addParam("user", "address")
  .setAction(async (args, hre) => {
    const s = (await import(`../deployments-${hre.network.name}.json`));
    const oa = await hre.ethers.getContractAt("OperationalAgreement", s.core.OperationalAgreement);
    await (await oa.approveMember(args.user)).wait();
    console.log("Member approved:", args.user);
  });
