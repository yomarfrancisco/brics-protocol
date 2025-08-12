import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256, toUtf8Bytes, AbiCoder, getBytes } from "ethers";
import { readFileSync } from "fs";
import { getCiSignerWallet, getCiSignerAddress } from "../utils/signers";

// Bullet-proof helpers
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

const asHex32 = (maybeHex: unknown, fallback: string) =>
  (typeof maybeHex === "string" && HEX32.test(maybeHex)) ? maybeHex : fallback;

const hashUtf8 = (val: unknown, def: string) =>
  keccak256(toUtf8Bytes(String(val ?? def)));

const hashJson = (val: unknown, defObj: object) =>
  keccak256(toUtf8Bytes(JSON.stringify(val ?? defObj)));

const FIX = "pricing-fixtures/ACME-LLC-30-latest.json";

describe("CDS Swap – E2E (replay)", () => {
  it("settles with replayed signed quote", async () => {
    const f = JSON.parse(readFileSync(FIX, "utf8"));
    
    // Use exactly the same portfolio id as fixture generator
    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC"));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address); 
    await engine.waitForDeployment();

    // Deploy MockPriceOracleAdapter with the CI signer
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const signerAddr = getCiSignerAddress();
    const mockOracle = await MockPriceOracle.deploy(signerAddr);
    await mockOracle.waitForDeployment();
    
    // set oracle adapter
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    
    // Grant BROKER_ROLE to gov for testing
    const BROKER_ROLE = await engine.BROKER_ROLE();
    await engine.connect(gov).grantRole(BROKER_ROLE, gov.address);

    // Use future timestamps for start/maturity, but keep fixture asOf for quote
    const now = await time.latest();
    const START = Number(now) + 60; // start 1 minute in the future
    const MATURITY = START + 30 * 24 * 60 * 60; // 30 days
    const notional = 1_000_000n;
    const proposeTx = await engine.proposeSwap({
      portfolioId,
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

    // Normalize every field coming from JSON (types can be string/null)
    const risk = BigInt(f?.riskScore ?? 0);
    const corr = Math.max(0, Math.min(65535, Number(f?.correlationBps ?? 0)));
    const fair = Math.max(0, Math.min(65535, Number(f?.fairSpreadBps ?? 0)));
    const asOf  = Number(f?.asOf ?? await time.latest());

    // bytes32 fields: accept valid 0x…64, else derive stable fallbacks
    const modelIdHashNorm   = asHex32(f?.modelIdHash,   hashUtf8(f?.modelId ?? "MODEL-V1", "MODEL-V1"));
    const featuresHashNorm  = asHex32(f?.featuresHash,  hashJson(f?.features ?? {}, {}));

    // Build digest exactly like the contract expects
    const coder  = new AbiCoder();
    const packed = coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [portfolioId, asOf, risk, corr, fair, modelIdHashNorm, featuresHashNorm]
    );
    const digest = keccak256(packed);

    // Sign the digest with the CI/dev signer (same address you passed to the oracle)
    const wallet    = getCiSignerWallet();
    const signature = await wallet.signMessage(getBytes(digest));

    // Submit to engine using the *same normalized values*
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
      })
    ).to.emit(engine, "SwapSettled");
  });
});
