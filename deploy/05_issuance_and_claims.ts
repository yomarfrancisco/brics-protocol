import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const DAO = process.env.DAO_MULTISIG || deployer.address;

  // RedemptionClaim
  const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
  const claims = await RedemptionClaim.deploy(DAO, state.core.MemberRegistry, state.core.ConfigRegistry);
  await claims.waitForDeployment();

  // ClaimRegistry
  const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy(DAO);
  await claimRegistry.waitForDeployment();

  // IssuanceControllerV3
  const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
  const controller = await IssuanceControllerV3.deploy(
    DAO,
    state.tranche.BRICSToken,
    state.tranche.TrancheManagerV2,
    state.core.ConfigRegistry,
    state.oracle.NAVOracleV3,
    state.finance.USDC,
    state.finance.Treasury,
    await claims.getAddress(),
    state.finance.PreTrancheBuffer,
    await claimRegistry.getAddress()
  );
  await controller.waitForDeployment();

  state.issuance = {
    RedemptionClaim: await claims.getAddress(),
    ClaimRegistry: await claimRegistry.getAddress(),
    IssuanceControllerV3: await controller.getAddress()
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Issuance & claims deployed:", state.issuance);
}
main().catch((e) => { console.error(e); process.exit(1); });
