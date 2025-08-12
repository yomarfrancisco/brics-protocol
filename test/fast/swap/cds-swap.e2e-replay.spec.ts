import { getCiSignerWallet, getCiSignerAddress } from "../../utils/signers";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";

// add near top (after imports)
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

function asHex32(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX32.test(v) ? v : fallback;
}

function hashUtf8(input: unknown, fallbackText: string): string {
  const txt =
    input === null || input === undefined
      ? fallbackText
      : typeof input === "string"
      ? input
      : JSON.stringify(input);
  return keccak256(toUtf8Bytes(txt));
}

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

    // Normalise possibly-missing fields from the fixture
    const risk = BigInt(f?.riskScore ?? 0);               // uint256
    const corr = Number(f?.correlationBps ?? 0);          // uint16
    const fair = Number(f?.fairSpreadBps ?? 0);           // uint16
    const asOf = Number(await time.latest());             // uint64

    const modelIdHashNorm = asHex32(
      f?.modelIdHash,
      hashUtf8(f?.modelId ?? "MODEL-V1", "MODEL-V1")
    );
    const featuresHashNorm = asHex32(
      f?.featuresHash,
      hashUtf8(f?.features ?? {}, "{}")
    );

    const coder = new AbiCoder();
    const packed = coder.encode(
      ["bytes32", "uint64", "uint256", "uint16", "uint16", "bytes32", "bytes32"],
      [portfolioId, asOf, risk, corr, fair, modelIdHashNorm, featuresHashNorm]
    );
    const digest = keccak256(packed);

    // Sign the digest with the same signer address we wired into the oracle
    const wallet = getCiSignerWallet();
    const signature = await wallet.signMessage(getBytes(digest));






    await expect(
      engine.settleSwap(swapId, {
        fairSpreadBps: fair,
        correlationBps: corr,
        asOf,
        riskScore: risk,
        modelIdHash: modelIdHashNorm,
        featuresHash: featuresHashNorm,
        digest,
        signature,
      })
    ).to.emit(engine, "SwapSettled");
  });
});
