import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const DAO = process.env.DAO_MULTISIG || deployer.address;
  const SPV = process.env.SPV_OPS_MULTISIG || deployer.address;

  // MemberRegistry
  const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
  const registry = await MemberRegistry.deploy(DAO);
  await registry.waitForDeployment();

  // OperationalAgreement
  const OperationalAgreement = await ethers.getContractFactory("OperationalAgreement");
  const oa = await OperationalAgreement.deploy(
    SPV, // nasasa param will be replaced by actual NASASA multisig if different
    SPV,
    await registry.getAddress()
  );
  await oa.waitForDeployment();

  // Set OA as registrar (requires DEFAULT_ADMIN_ROLE on registry which DAO has; deployer defaults to DAO locally)
  await (await registry.setRegistrar(await oa.getAddress())).wait();

  // ConfigRegistry
  const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
  const cfg = await ConfigRegistry.deploy(DAO);
  await cfg.waitForDeployment();

  state.core = {
    MemberRegistry: await registry.getAddress(),
    OperationalAgreement: await oa.getAddress(),
    ConfigRegistry: await cfg.getAddress()
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Core deployed:", state.core);
}
main().catch((e) => { console.error(e); process.exit(1); });
