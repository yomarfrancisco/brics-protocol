import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes } from "ethers";
import { readFileSync } from "node:fs";
import { getCiSignerWallet, getCiSignerAddress } from "../utils/signers";

const FIX = "pricing-fixtures/ACME-LLC-30-latest.json";
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

const asHex32 = (maybeHex: unknown, fallback: string) =>
  (typeof maybeHex === "string" && HEX32.test(maybeHex)) ? maybeHex : fallback;

const hashUtf8 = (v: unknown, def: string) =>
  keccak256(toUtf8Bytes(String(v ?? def)));

const hashJson = (v: unknown, def: object) =>
  keccak256(toUtf8Bytes(JSON.stringify(v ?? def)));

describe("CDS Swap – E2E (replay)", () => {
  let oracleSignerAddr: string;

  before(async () => {
    oracleSignerAddr = getCiSignerAddress();
  });

  it("settles with replayed signed quote", async () => {
    const f = JSON.parse(readFileSync(FIX, "utf8"));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address);
    await engine.waitForDeployment();

    // Use CI/dev signer for the oracle (fixture signer may be null)
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const mockOracle = await MockPriceOracle.deploy(oracleSignerAddr);
    await mockOracle.waitForDeployment();

    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    const BROKER_ROLE = await engine.BROKER_ROLE();
    await engine.connect(gov).grantRole(BROKER_ROLE, gov.address);

    // Propose/activate a tiny swap
    const now = await time.latest();
    const START = Number(now) + 60;
    const MATURITY = START + 30 * 24 * 60 * 60;
    const notional = 1_000_000n;

    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC")); // <- same as generator

    const proposeTx = await engine.proposeSwap({
      portfolioId,
      protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },
      protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },
      correlationBps: Number(f?.correlationBps ?? 0)
    });
    const rcpt = await proposeTx.wait();
    const swapId = rcpt!.logs.find((l: any) => l.fragment?.name === "SwapProposed").args.swapId;
    await engine.activateSwap(swapId);

    // Be inside validity window
    await time.increaseTo(START + 24 * 60 * 60);

    // ---------- Normalize all fields ----------
    const risk = BigInt(f?.riskScore ?? 0);
    const corr = Math.max(0, Math.min(65535, Number(f?.correlationBps ?? 0)));
    const fair = Math.max(0, Math.min(65535, Number(f?.fairSpreadBps ?? 0)));
    const asOf = Number(await time.latest()); // fresh to avoid staleness

    const modelIdHashNorm  = asHex32(f?.modelIdHash,  hashUtf8(f?.modelId ?? "MODEL-V1", "MODEL-V1"));
    const featuresHashNorm = asHex32(f?.featuresHash, hashJson(f?.features ?? {}, {}));

    // Digest identical to on-chain expectation
    const coder = new AbiCoder();
    const packed = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [portfolioId, asOf, risk, corr, fair, modelIdHashNorm, featuresHashNorm]
    );
    const digest = keccak256(packed);

    // Sign digest with oracle signer
    const wallet = getCiSignerWallet();
    const signature = await wallet.signMessage(getBytes(digest));

    // Use the SAME normalized values in the call
    await expect(
      engine.settleSwap(swapId, {
        fairSpreadBps:  fair,
        correlationBps: corr,
        asOf,
        riskScore:      risk,
        modelIdHash:    modelIdHashNorm,
        featuresHash:   featuresHashNorm,
        digest,
        signature
      }, 15, 30) // elapsedDays, tenorDays
    ).to.emit(engine, "SettlementExecuted");
  });
});
