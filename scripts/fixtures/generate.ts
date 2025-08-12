// scripts/fixtures/generate.ts
import hre from "hardhat";
import { getCiSignerWallet, getCiSignerAddress } from "../../test/utils/signers";
import { writeFileSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { ethers } from "ethers";

async function main() {
  const signerAddr = getCiSignerAddress();
  const signer = getCiSignerWallet();

  // Pin all non-deterministic inputs
  const FIXTURE_NAME = "ACME-LLC-30";
  const asOf = Math.floor(Date.now() / 1000) + 60; // 1 minute in the future
  const modelIdHash = ethers.keccak256(ethers.toUtf8Bytes("MODEL_V1"));
  const featuresHash = ethers.keccak256(ethers.toUtf8Bytes("FEATURES_V1"));
  const correlationBps = 3200;
  const fairSpreadBps = 725;
  const riskScore = 6400;
  const chainId = 31337; // pin for local/CI

  // Produce deterministic digest (must match RiskSignalLib.digest())
  // digest = keccak256(abi.encode(
  //   portfolioId, asOf, riskScore, correlationBps, spreadBps, modelIdHash, featuresHash
  // ))
  const portfolioId = ethers.keccak256(ethers.toUtf8Bytes("ACME-LLC"));
  const abiCoder = new ethers.AbiCoder();
  const packed = abiCoder.encode(
    ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
    [portfolioId, asOf, riskScore, correlationBps, fairSpreadBps, modelIdHash, featuresHash]
  );
  const digest = ethers.keccak256(packed);

  // Sign with pinned signer
  const signature = await signer.signMessage(ethers.getBytes(digest));

  const out = {
    name: FIXTURE_NAME,
    asOf,
    modelIdHash,
    featuresHash,
    correlationBps,
    fairSpreadBps,
    riskScore,
    chainId,
    signer: signerAddr,
    digest,
    signature
  };

  const latestPath = join(process.cwd(), "pricing-fixtures", `${FIXTURE_NAME}-latest.json`);
  writeFileSync(latestPath, JSON.stringify(out, null, 2));

  // Write sha256 for "latest" as FYI (not used by tests)
  const sha = crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");
  writeFileSync(
    join(process.cwd(), "pricing-fixtures", `${FIXTURE_NAME}-latest.sha256`),
    `${sha}\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
