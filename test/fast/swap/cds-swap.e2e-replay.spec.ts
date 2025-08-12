import { getCiSignerWallet, getCiSignerAddress } from "../../utils/signers";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";

// Optional helper: if the frozen fixture looks stale locally, guide the developer.
// (We don't auto-mutate files in tests; keep mutation in scripts/fixtures/generate.ts only.)
import fs from "node:fs";
const FIXTURE_PATH = "pricing-fixtures/ACME-LLC-30-frozen.json";
const inCI = !!process.env.GITHUB_ACTIONS;
try {
  const s = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (!inCI && typeof s.asOf === "number" && now - s.asOf > 60 * 60 * 24 * 5) {
    // eslint-disable-next-line no-console
    console.warn(
      "[replay] Frozen fixture may be stale locally (>5 days old). If tests fail on staleness, run `yarn fixtures:freeze`."
    );
  }
} catch {
  // ignore if fixture path changed; core tests will surface a clear error
}

import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { readFileSync } from "fs";

const FIX = "pricing-fixtures/ACME-LLC-30-latest.json";

describe("CDS Swap – E2E (replay)", () => {
  let walletAddr: string;

  before(async () => {
    walletAddr = getCiSignerAddress();
  });

  it("settles with replayed signed quote", async () => {
    const f = JSON.parse(readFileSync(FIX, "utf8"));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address); await engine.waitForDeployment();

    // Deploy MockPriceOracleAdapter with the signer from helper
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const mockOracle = await MockPriceOracle.deploy(walletAddr);
    await mockOracle.waitForDeployment();
    
    // set oracle adapter
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    
    // Grant BROKER_ROLE to gov for testing
    const BROKER_ROLE = await engine.BROKER_ROLE();
    await engine.connect(gov).grantRole(BROKER_ROLE, gov.address);

    // Dynamic timestamps - ensure we're in the future
    const now = await time.latest();
    const START = Number(now) + 60; // 1 minute in the future
    const MATURITY = START + 30 * 24 * 60 * 60; // 30 days
    const notional = 1_000_000n;
    const proposeTx = await engine.proposeSwap({
      portfolioId: keccak256(toUtf8Bytes("ACME-LLC")),
      protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },
      protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },
      correlationBps: f.correlationBps
    });
    const receipt = await proposeTx.wait();
    const swapId = receipt.logs.find((log: any) => 
      log.fragment?.name === "SwapProposed"
    ).args.swapId;
    await engine.activateSwap(swapId);

    // Advance time to be within quote validity window
    await time.increaseTo(START + 24 * 60 * 60); // 1 day after start

    // Use *exactly* the same portfolio id as fixture generator uses
    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC"));

    // Normalize possibly-missing fields from fixture
    const modelIdHash =
      f.modelIdHash && /^0x[0-9a-fA-F]{64}$/.test(f.modelIdHash)
        ? f.modelIdHash
        : keccak256(toUtf8Bytes(String(f.modelId ?? "MODEL-V1")));

    const featuresHash =
      f.featuresHash && /^0x[0-9a-fA-F]{64}$/.test(f.featuresHash)
        ? f.featuresHash
        : keccak256(toUtf8Bytes(JSON.stringify(f.features ?? {})));

    const corr = Number(f.correlationBps ?? 0);
    const fair = Number(f.fairSpreadBps ?? 0);
    const asOf = await time.latest(); // avoid QUOTE_STALE_SECONDS

    const coder = new AbiCoder();
    const packed = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [portfolioId, asOf, f.riskScore, corr, fair, modelIdHash, featuresHash]
    );
    const digest = keccak256(packed);

    // Sign digest with same signer the engine will recover
    const wallet = getCiSignerWallet();
    const signature = await wallet.signMessage(getBytes(digest));






    // Submit to engine
    await expect(engine.settleSwap(swapId, {
      fairSpreadBps: f.fairSpreadBps,
      correlationBps: f.correlationBps,
      asOf: asOf,
      riskScore: f.riskScore,
      modelIdHash: f.modelIdHash,
      featuresHash: f.featuresHash,
      digest: digest,
      signature: signature
    })).to.emit(engine, "SwapSettled");
  });
});
