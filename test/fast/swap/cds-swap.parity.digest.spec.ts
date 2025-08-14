import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { signDigestEip191, verifyDigestEip191 } from "../../utils/signing";

const coder = new AbiCoder();

function tsDigest(p:any) {
  const enc = coder.encode(
    ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
    [p.portfolioId, p.asOf, p.riskScore, p.correlationBps, p.spreadBps, p.modelIdHash, p.featuresHash]
  );
  return keccak256(enc);
}

describe("RiskSignal parity — TS vs Solidity digest + sign", () => {
  it("matches digest and recovers signer", async () => {
    const [oracle] = await ethers.getSigners();

    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC"));
    const modelIdHash = keccak256(toUtf8Bytes("baseline-v0"));
    const featuresHash = keccak256(toUtf8Bytes(
      `{"countryRisk":0.2,"dataQuality":0.8,"fxExposure":0.1,"industryStress":0.4,"leverage":0.5,"modelShift":0.1,"size":1.2,"volatility":0.3,"collateralQuality":0.7}`
    ));

    const p = {
      portfolioId,
      asOf: Math.floor(Date.now()/1000),
      riskScore: 54n,
      correlationBps: 1103,
      spreadBps: 71,
      modelIdHash,
      featuresHash
    };

    const Debug = await ethers.getContractFactory("RiskSignalDebug");
    const dbg = await Debug.deploy(); await dbg.waitForDeployment();

    const onchain = await dbg.digest(
      p.portfolioId, p.asOf, p.riskScore, p.correlationBps, p.spreadBps, p.modelIdHash, p.featuresHash
    );
    const offchain = tsDigest(p);
    expect(onchain).to.equal(offchain);

    const sig = await signDigestEip191(oracle, offchain);
    // Now call engine.verifyQuote via your existing public function OR
    // recover off-chain and compare
    const rec = verifyDigestEip191(offchain, sig);
    expect(rec.toLowerCase()).to.equal((await oracle.getAddress()).toLowerCase());
  });
});
