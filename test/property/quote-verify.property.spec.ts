import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getCiSignerWallet, getCiSignerAddress } from "../utils/signers";

// Simple, deterministic PRNG
function rand(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2**32; };
}
function randInt(r: () => number, lo: number, hi: number) {
  return Math.floor(lo + r() * (hi - lo + 1));
}

describe("Property: quote verification", () => {
  it("accepts valid signatures, rejects mutated ones (deterministic)", async () => {
    let validCount = 0;
    let invalidCount = 0;
    const [gov, buyer, seller] = await ethers.getSigners();

    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address);
    await engine.waitForDeployment();

    const oracleAddr = getCiSignerAddress();
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const mockOracle = await MockPriceOracle.deploy(oracleAddr);
    await mockOracle.waitForDeployment();
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());

    const BROKER_ROLE = await engine.BROKER_ROLE();
    await engine.connect(gov).grantRole(BROKER_ROLE, gov.address);

    // Deterministic parameters
    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC"));
    const modelIdHash = keccak256(toUtf8Bytes("MODEL-V1"));
    const featuresHash = keccak256(toUtf8Bytes("{}"));
    const risk = 123456789n;

    const coder = new AbiCoder();
    const wallet = getCiSignerWallet();

    const seed = Number(process.env.FIXTURE_SEED ?? 42);
    const r = rand(seed);

    const trials = Number(process.env.PROP_TRIALS ?? 32); // Environment-gated trial count
    for (let i = 0; i < trials; i++) {
      // Create a new swap for each trial with future start time
      const now = await time.latest();
      const trialStart = Number(now) + 60 + i * 100; // Offset each trial
      const trialMaturity = trialStart + 30 * 24 * 60 * 60;
      const notional = 1_000_000n;
      
      const tx = await engine.proposeSwap({
        portfolioId: keccak256(toUtf8Bytes("ACME-LLC")),
        protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(trialStart), maturity: BigInt(trialMaturity) },
        protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(trialStart), maturity: BigInt(trialMaturity) },
        correlationBps: 2000
      });
      const receipt = await tx.wait();
      const trialSwapId = receipt.logs.find((l:any)=>l.fragment?.name==="SwapProposed").args.swapId;
      await engine.activateSwap(trialSwapId);

      // Advance time to be within the swap's validity window
      await time.increaseTo(trialStart + 24 * 60 * 60);

      const asOf = Number(await time.latest());
      const corr = randInt(r, 0, 10000); // 0..10000 bps
      const fair = randInt(r, 0, 2000);  // 0..2000 bps

      const packed = coder.encode(
        ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
        [portfolioId, asOf, risk, corr, fair, modelIdHash, featuresHash]
      );
      const digest = keccak256(packed);
      const sig = await wallet.signMessage(getBytes(digest));

      // Valid should settle
      await expect(engine.settleSwap(trialSwapId, {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf,
        riskScore: risk,
        modelIdHash,
        featuresHash,
        digest,
        signature: sig
      })).to.emit(engine, "SwapSettled");
      validCount++;

      // Test with mutated digest (should revert)
      const badDigest = ("0x" + (BigInt(digest) ^ 1n).toString(16).padStart(64,"0")) as `0x${string}`;
      
      // Create another swap for the invalid signature test
      const now2 = await time.latest();
      const trialStart2 = Number(now2) + 60 + i * 100 + 50; // Different offset
      const trialMaturity2 = trialStart2 + 30 * 24 * 60 * 60;
      
      const tx2 = await engine.proposeSwap({
        portfolioId: keccak256(toUtf8Bytes("ACME-LLC")),
        protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(trialStart2), maturity: BigInt(trialMaturity2) },
        protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(trialStart2), maturity: BigInt(trialMaturity2) },
        correlationBps: 2000
      });
      const receipt2 = await tx2.wait();
      const trialSwapId2 = receipt2.logs.find((l:any)=>l.fragment?.name==="SwapProposed").args.swapId;
      await engine.activateSwap(trialSwapId2);

      // Advance time for the second swap
      await time.increaseTo(trialStart2 + 24 * 60 * 60);

      await expect(engine.settleSwap(trialSwapId2, {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf,
        riskScore: risk,
        modelIdHash,
        featuresHash,
        digest: badDigest,
        signature: sig
      })).to.be.reverted;
      invalidCount++;
    }
    
    // Light distribution check with panic if deviation >±10% from expected
    const expectedValidRatio = 0.5; // 50% valid, 50% invalid
    const totalTrials = validCount + invalidCount;
    const actualValidRatio = validCount / totalTrials;
    const deviation = Math.abs(actualValidRatio - expectedValidRatio);
    
    console.log(`📊 Property test distribution: ${validCount} valid, ${invalidCount} invalid (${(actualValidRatio * 100).toFixed(1)}% valid)`);
    console.log(`📈 Deviation from expected 50/50: ${(deviation * 100).toFixed(1)}%`);
    
    expect(validCount).to.be.greaterThan(0);
    expect(invalidCount).to.be.greaterThan(0);
    
    if (deviation > 0.1) {
      throw new Error(`Distribution deviation too high: ${(deviation * 100).toFixed(1)}% > 10%. Expected ~50% valid, got ${(actualValidRatio * 100).toFixed(1)}%`);
    }
  });
});
