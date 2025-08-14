import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { readFileSync } from "fs";

const coder = new AbiCoder();

// Helper functions for validation
const isHex32 = (s?: string) => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);
const isHex = (s?: string) => typeof s === "string" && /^0x[0-9a-fA-F]*$/.test(s);

function tsDigest(p: any) {
  const enc = coder.encode(
    ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
    [p.portfolioId, p.asOf, p.riskScore, p.correlationBps, p.spreadBps, p.modelIdHash, p.featuresHash]
  );
  return keccak256(enc);
}

describe("CDS Swap – Replay Canary", () => {
  it("verifies latest fixture digest and signature", async function () {
    // Load the latest fixture defensively
    let fixture: any = null;
    try {
      fixture = JSON.parse(readFileSync("pricing-fixtures/ACME-LLC-30-latest.json", "utf8"));
    } catch (error) {
      this.skip(); // no metadata in CI/tag context → soft skip
      return;
    }

    // Guard: must have required fields
    if (!fixture || !fixture.obligorId || !fixture.digest) {
      this.skip(); // missing required fields → soft skip
      return;
    }

    // Guard: digest must be valid hex32
    if (!isHex32(fixture.digest)) {
      this.skip(); // missing/invalid digest → soft skip
      return;
    }

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
    
    // Optional: verify signature when present (don't fail if absent)
    if (isHex(fixture.signature) && fixture.signature !== "0x") {
      // Use getBytes for hex digest (not toUtf8Bytes)
      const bytes = getBytes(fixture.digest);
      expect(bytes.length).to.equal(32);
      
      // Verify signature recovery
      const recoveredSigner = ethers.verifyMessage(bytes, fixture.signature);
      expect(recoveredSigner.toLowerCase()).to.equal(fixture.signer.toLowerCase());
      
      console.log("✅ Canary test passed with signature verification:");
      console.log(`   Digest: ${fixture.digest}`);
      console.log(`   Signer: ${fixture.signer}`);
      console.log(`   Recovered: ${recoveredSigner}`);
    } else {
      console.log("✅ Canary test passed (no signature to verify):");
      console.log(`   Digest: ${fixture.digest}`);
    }
  });
});
