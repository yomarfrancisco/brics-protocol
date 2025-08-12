#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { INAVOracleV3__factory } from "../../typechain-types";

// Oracle operations script for NAVOracleV3
// Usage: npx hardhat run scripts/oracle/ops.ts --network <network>

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Oracle operations script");
  console.log("Deployer:", await deployer.getAddress());

  // Oracle address (set this to your deployed oracle)
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS;
  if (!ORACLE_ADDRESS) {
    throw new Error("ORACLE_ADDRESS environment variable not set");
  }

  const oracle = INAVOracleV3__factory.connect(ORACLE_ADDRESS, deployer);

  // Get current state
  console.log("\n=== Current Oracle State ===");
  console.log("Latest NAV:", ethers.formatUnits(await oracle.latestNAVRay(), 27));
  console.log("Last Update TS:", await oracle.lastUpdateTs());
  console.log("Is Emergency:", await oracle.isEmergency());
  console.log("Model Hash:", await oracle.modelHash());
  console.log("Signers:", await oracle.getSigners());
  console.log("Quorum:", await oracle.getQuorum());

  // Example operations (uncomment as needed)

  // 1. Submit NAV with signatures
  // await submitNAV(oracle, "1.05", ["signature1", "signature2"]);

  // 2. Rotate signers
  // await rotateSigners(oracle, ["0x...", "0x..."]);

  // 3. Update quorum
  // await updateQuorum(oracle, 3);

  // 4. Roll model hash
  // await rollModelHash(oracle, "0x...");

  // 5. Enable emergency NAV
  // await enableEmergencyNAV(oracle, "0.95");

  // 6. Disable emergency NAV
  // await disableEmergencyNAV(oracle);
}

async function submitNAV(oracle: any, navValue: string, signatures: string[]) {
  console.log(`\n=== Submitting NAV: ${navValue} ===");
  const navRay = ethers.parseUnits(navValue, 27);
  const ts = Math.floor(Date.now() / 1000);
  
  try {
    const tx = await oracle.submitNAV(navRay, ts, signatures);
    await tx.wait();
    console.log("✅ NAV submitted successfully");
  } catch (error) {
    console.error("❌ Failed to submit NAV:", error);
  }
}

async function rotateSigners(oracle: any, newSigners: string[]) {
  console.log(`\n=== Rotating Signers ===");
  console.log("New signers:", newSigners);
  
  try {
    const tx = await oracle.rotateSigners(newSigners);
    await tx.wait();
    console.log("✅ Signers rotated successfully");
  } catch (error) {
    console.error("❌ Failed to rotate signers:", error);
  }
}

async function updateQuorum(oracle: any, newQuorum: number) {
  console.log(`\n=== Updating Quorum to ${newQuorum} ===");
  
  try {
    const tx = await oracle.updateQuorum(newQuorum);
    await tx.wait();
    console.log("✅ Quorum updated successfully");
  } catch (error) {
    console.error("❌ Failed to update quorum:", error);
  }
}

async function rollModelHash(oracle: any, newModelHash: string) {
  console.log(`\n=== Rolling Model Hash ===");
  console.log("New model hash:", newModelHash);
  
  try {
    const tx = await oracle.rollModelHash(newModelHash);
    await tx.wait();
    console.log("✅ Model hash rolled successfully");
  } catch (error) {
    console.error("❌ Failed to roll model hash:", error);
  }
}

async function enableEmergencyNAV(oracle: any, emergencyNavValue: string) {
  console.log(`\n=== Enabling Emergency NAV: ${emergencyNavValue} ===");
  const emergencyNavRay = ethers.parseUnits(emergencyNavValue, 27);
  
  try {
    const tx = await oracle.enableEmergencyNAV(emergencyNavRay);
    await tx.wait();
    console.log("✅ Emergency NAV enabled successfully");
  } catch (error) {
    console.error("❌ Failed to enable emergency NAV:", error);
  }
}

async function disableEmergencyNAV(oracle: any) {
  console.log(`\n=== Disabling Emergency NAV ===");
  
  try {
    const tx = await oracle.disableEmergencyNAV();
    await tx.wait();
    console.log("✅ Emergency NAV disabled successfully");
  } catch (error) {
    console.error("❌ Failed to disable emergency NAV:", error);
  }
}

// Helper function to generate EIP-712 signature
async function generateSignature(
  signer: any,
  navRay: bigint,
  ts: number,
  modelHash: string,
  oracleAddress: string
): Promise<string> {
  const domain = {
    name: "BRICS-NAV",
    version: "3",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: oracleAddress
  };

  const types = {
    NAV: [
      { name: "navRay", type: "uint256" },
      { name: "ts", type: "uint256" },
      { name: "modelHash", type: "bytes32" }
    ]
  };

  const value = {
    navRay: navRay,
    ts: ts,
    modelHash: modelHash
  };

  return await signer.signTypedData(domain, types, value);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
