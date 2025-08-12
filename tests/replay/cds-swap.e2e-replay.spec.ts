import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256, toUtf8Bytes } from "ethers";
import { readFileSync } from "fs";

const FIX = "pricing-fixtures/ACME-LLC-30-latest.json";

describe("CDS Swap – E2E (replay)", () => {
  it("settles with replayed signed quote", async () => {
    const f = JSON.parse(readFileSync(FIX, "utf8"));
    const portfolioId = keccak256(toUtf8Bytes(f.obligorId));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address); await engine.waitForDeployment();

    // Deploy MockPriceOracleAdapter with the fixture signer
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const mockOracle = await MockPriceOracle.deploy(f.signer);
    await mockOracle.waitForDeployment();
    
    // set oracle adapter
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    
    // Quick guardrails: assert signer parity
    expect(f.signer.toLowerCase()).to.equal((await mockOracle.riskOracle()).toLowerCase());
    
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

    // Freshness: use Hardhat time helpers to ensure quote is fresh
    const now = await time.latest();
    const QUOTE_STALE_SECONDS = 300; // 5 minutes
    
    // If fixture.asOf is stale, advance block time to fixture.asOf + 60
    if (Number(f.asOf) < Number(now) - QUOTE_STALE_SECONDS) {
      await time.increaseTo(Number(f.asOf) + 60);
    }

    const settleTx = await engine.settleSwap(swapId, {
      fairSpreadBps: f.fairSpreadBps,
      correlationBps: f.correlationBps,
      asOf: f.asOf,
      riskScore: f.riskScore,
      modelIdHash: f.modelIdHash,
      featuresHash: f.featuresHash,
      digest: f.digest,
      signature: f.signature
    });
    await settleTx.wait();

    const meta = await engine.swaps(swapId);
   expect(meta.status).to.equal(2); // Settled
  });
});
