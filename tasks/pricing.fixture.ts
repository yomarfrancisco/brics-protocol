import { task } from "hardhat/config";
import { keccak256, toUtf8Bytes, AbiCoder, getBytes, Wallet, hexlify } from "ethers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

task("pricing:fixture", "Generate a signed pricing quote fixture")
  .addParam("obligor", "Obligor ID (e.g. ACME-LLC)")
  .addParam("tenor", "Tenor days", undefined, undefined, true)
  .addParam("asof", "Unix seconds asOf", undefined, undefined, true)
  .addParam("out", "Output directory (default: pricing-fixtures)", "pricing-fixtures")
  .setAction(async (args, hre) => {
    const obligorId: string = args.obligor;
    const tenorDays: number = Number(args.tenor ?? 30);
    const asOf: number = Number(args.asof ?? 1700000000);
    const outDir: string = args.out || "pricing-fixtures";

    const modelId = "baseline-v0";
    const modelIdHash = keccak256(toUtf8Bytes(modelId));
    const features = { size: 1.2, leverage: 0.5 }; // deterministic minimal set
    const featuresJson = `{${Object.keys(features).sort().map(k=>`"${k}":${Number((features as any)[k])}`).join(",")}}`;
    const featuresHash = keccak256(toUtf8Bytes(featuresJson));

    const portfolioId = keccak256(toUtf8Bytes(obligorId));
    const riskScore = 54n;
    const fairSpreadBps = 71;
    const correlationBps = 1103;

    // Digest = keccak256(abi.encode(bytes32,uint64,uint256,uint16,uint16,bytes32,bytes32))
    const coder = new AbiCoder();
    const enc = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [portfolioId, BigInt(asOf), riskScore, correlationBps, fairSpreadBps, modelIdHash, featuresHash]
    );
    const digest = keccak256(getBytes(enc));

    // Use deterministic oracle key (same as parity tests)
   const oracleKey = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const signer = oracleKey.address;

    // SIGN RAW DIGEST (Solidity adds EIP-191 prefix when recovering)
    const sig = await oracleKey.signingKey.sign(digest);
    const v = sig.v >= 27 ? sig.v : sig.v + 27;
    const r = hexlify(sig.r);
    const s = hexlify(sig.s);
    const signature = r + s.slice(2) + (v === 27 ? "1b" : "1c");

    const payload = {
      obligorId, tenorDays, asOf,
      fairSpreadBps, correlationBps,
      riskScore: Number(riskScore),
      modelIdHash, featuresHash,
      digest, signature, signer
    };

    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${obligorId}-${tenorDays}-${asOf}.json`);
    writeFileSync(file, JSON.stringify(payload, null, 2));
    console.log("Fixture written:", file);
  });
