import { task } from "hardhat/config";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const coder = new AbiCoder();

function abiDigest(p: any) {
  const encoded = coder.encode(
    ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
    [p.portfolioId, p.asOf, p.riskScore, p.correlationBps, p.spreadBps, p.modelIdHash, p.featuresHash]
  );
  return keccak256(encoded);
}

task("pricing:fixture", "Generate replay fixture with real signature")
  .addParam("obligor")
  .addParam("tenor")
  .addParam("asof")
  .setAction(async ({ obligor, tenor, asof }, hre) => {
    const [signer] = await hre.ethers.getSigners(); // must be the oracle signer
    
    // Freshness window: set asOf = NOW - 120s for CI time skew tolerance
    const now = Math.floor(Date.now() / 1000);
    const freshAsOf = now - 120;
    
    const portfolioId = keccak256(toUtf8Bytes(obligor));
    // Build your modelIdHash, featuresHash exactly like service does:
    const modelIdHash = keccak256(toUtf8Bytes("baseline-v0"));
    const featuresCanonical = `{"countryRisk":0.2,"dataQuality":0.8,"fxExposure":0.1,"industryStress":0.4,"leverage":0.5,"modelShift":0.1,"size":1.2,"volatility":0.3,"collateralQuality":0.7}`;
    const featuresHash = keccak256(toUtf8Bytes(featuresCanonical));

    const quote = {
      portfolioId,
      asOf: freshAsOf,
      riskScore: 54n,                // or your chosen EL_bps integer
      correlationBps: 1103,
      spreadBps: 71,
      modelIdHash,
      featuresHash,
    };

    const digest = abiDigest(quote);
    const signature = await signer.signMessage(hre.ethers.getBytes(digest));

    console.log("FIXTURE_DEBUG", JSON.stringify({
      portfolioId,
      asOf: quote.asOf,
      riskScore: quote.riskScore.toString(),
      correlationBps: quote.correlationBps,
      spreadBps: quote.spreadBps,
      modelIdHash,
      featuresHash,
      digest,
      signer: await signer.getAddress(),
      sigLen: signature.length,
      signature
    }, null, 2));

    // write JSON fixture exactly as your replay provider expects
    const payload = {
      obligorId: obligor,
      tenorDays: Number(tenor),
      asOf: quote.asOf,
      fairSpreadBps: quote.spreadBps,
      correlationBps: quote.correlationBps,
      riskScore: Number(quote.riskScore),
      modelIdHash,
      featuresHash,
      digest,
      signature,
      signer: await signer.getAddress()
    };

    const outDir = "pricing-fixtures";
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${obligor}-${tenor}-latest.json`);
    writeFileSync(file, JSON.stringify(payload, null, 2));
    
    // Compute SHA-256 checksum
    const crypto = require('crypto');
    const fileContent = JSON.stringify(payload, null, 2);
    const sha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
    const checksumFile = file.replace('.json', '.sha256');
    writeFileSync(checksumFile, sha256);
    
    console.log("FIXTURE_SUMMARY", JSON.stringify({
      file: file,
      digest: digest,
      sha256: sha256,
      signer: await signer.getAddress()
    }, null, 2));
    console.log("Fixture written:", file);
    console.log("Checksum written:", checksumFile);
  });
