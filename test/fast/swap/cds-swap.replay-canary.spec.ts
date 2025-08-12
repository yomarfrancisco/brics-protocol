import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { readFileSync } from "fs";

const coder = new AbiCoder();

function tsDigest(p: any) {
  const enc = coder.encode(
    ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
    [p.portfolioId, p.asOf, p.riskScore, p.correlationBps, p.spreadBps, p.modelIdHash, p.featuresHash]
  );
  return keccak256(enc);
}

describe("CDS Swap – Replay Canary", () => {
  it("verifies latest fixture digest and signature", async () => {
    // Load the latest fixture
    const fixture = JSON.parse(readFileSync("pricing-fixtures/ACME-LLC-30-latest.json", "utf8"));
    
    // Recompute the ABI-encoded digest in TS
    const portfolioId = keccak256(toUtf8Bytes(fixture.obligorId));
    const payload = {
      portfolioId,
      asOf: fixture.asOf,
      riskScore: BigInt(fixture.riskScore),
      correlationBps: fixture.correlationBps,
      spreadBps: fixture.fairSpreadBps,
      modelIdHash: fixture.modelIdHash,
      featuresHash: fixture.featuresHash
    };
    
    const computedDigest = tsDigest(payload);
    
    // Assert digest matches
    expect(computedDigest).to.equal(fixture.digest);
    
    // Verify signature recovery
    const recoveredSigner = ethers.verifyMessage(getBytes(fixture.digest), fixture.signature);
    expect(recoveredSigner.toLowerCase()).to.equal(fixture.signer.toLowerCase());
    
    console.log("✅ Canary test passed:");
    console.log(`   Digest: ${fixture.digest}`);
    console.log(`   Signer: ${fixture.signer}`);
    console.log(`   Recovered: ${recoveredSigner}`);
  });
});
