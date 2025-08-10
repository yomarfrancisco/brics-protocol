import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));
  const [deployer] = await ethers.getSigners();

  const DAO = process.env.DAO_MULTISIG || deployer.address;
  const TREASURY_OPS = process.env.TREASURY_OPS_MULTISIG || deployer.address;
  const SPV = process.env.SPV_OPS_MULTISIG || deployer.address;

  const brics = await ethers.getContractAt("BRICSToken", state.tranche.BRICSToken);
  const controller = await ethers.getContractAt("IssuanceControllerV3", state.issuance.IssuanceControllerV3);
  const registry = await ethers.getContractAt("MemberRegistry", state.core.MemberRegistry);
  const oa = await ethers.getContractAt("OperationalAgreement", state.core.OperationalAgreement);
  const cfg = await ethers.getContractAt("ConfigRegistry", state.core.ConfigRegistry);
  const tm = await ethers.getContractAt("TrancheManagerV2", state.tranche.TrancheManagerV2);
  const treasury = await ethers.getContractAt("Treasury", state.finance.Treasury);
  const pre = await ethers.getContractAt("PreTrancheBuffer", state.finance.PreTrancheBuffer);
  const oracle = await ethers.getContractAt("NAVOracleV3", state.oracle.NAVOracleV3);
  const claims = await ethers.getContractAt("RedemptionClaim", state.issuance.RedemptionClaim);

  // Grant MINTER/BURNER to controller
  const MINTER = ethers.keccak256(ethers.toUtf8Bytes("MINTER"));
  const BURNER = ethers.keccak256(ethers.toUtf8Bytes("BURNER"));
  await (await brics.grantRole(MINTER, await controller.getAddress())).wait();
  await (await brics.grantRole(BURNER, await controller.getAddress())).wait();

  // Registry: set registrar (OperationalAgreement ctor sets it, but we reinforce)
  await (await registry.grantRole(await registry.DEFAULT_ADMIN_ROLE(), DAO)).wait();

  // Treasury roles
  const PAY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAY"));
  await (await treasury.grantRole(PAY_ROLE, TREASURY_OPS)).wait();

  // PreTranche buffer manager
  const BUFFER_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("BUFFER_MANAGER"));
  await (await pre.grantRole(BUFFER_MANAGER, TREASURY_OPS)).wait();
  // Also allow controller to trigger instant redeems
  await (await pre.grantRole(BUFFER_MANAGER, await controller.getAddress())).wait();

  // Config emergency level NORMAL
  await (await cfg.setEmergencyLevel(0, "bootstrap")).wait();

  // Tranche cap (example; adjust)
  await (await tm.adjustSuperSeniorCap(ethers.parseUnits("50000000", 18))).wait();

  // IssuanceController ratify initial detachment
  await (await controller.ratifyDetachment()).wait();

  // Claim issuer
  const ISSUER = ethers.keccak256(ethers.toUtf8Bytes("ISSUER"));
  await (await claims.grantRole(ISSUER, SPV)).wait();

  // Grant ECC_ROLE to deployer for localhost testing
  const ECC_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ECC"));
  await (await tm.grantRole(ECC_ROLE, deployer.address)).wait();

  state.post = { roles: "assigned", params: "seeded" };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Roles & params configured.");
}
main().catch((e) => { console.error(e); process.exit(1); });
