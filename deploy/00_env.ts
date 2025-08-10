import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import hre from "hardhat";

async function main() {
  console.log("Environment snapshot...");
  const env = {
    DAO_MULTISIG: process.env.DAO_MULTISIG,
    ECC_MULTISIG: process.env.ECC_MULTISIG,
    SPV_OPS_MULTISIG: process.env.SPV_OPS_MULTISIG,
    TREASURY_OPS_MULTISIG: process.env.TREASURY_OPS_MULTISIG,
    USDC_ADDRESS: process.env.USDC_ADDRESS,
    MODEL_SIGNERS: [
      process.env.MODEL_SIGNER_1,
      process.env.MODEL_SIGNER_2,
      process.env.MODEL_SIGNER_3,
      process.env.MODEL_SIGNER_4,
      process.env.MODEL_SIGNER_5
    ].filter(Boolean),
    EMERGENCY_SIGNERS: [
      process.env.EMERGENCY_SIGNER_NASASA,
      process.env.EMERGENCY_SIGNER_OLDMUTUAL
    ].filter(Boolean),
    MODEL_HASH: process.env.MODEL_HASH
  };
  writeFileSync(`deployments-${hre.network.name}.json`, JSON.stringify({ env }, null, 2));
  console.log("OK.");
}
main().catch((e) => { console.error(e); process.exit(1); });
