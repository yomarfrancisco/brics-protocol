import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256, toUtf8Bytes } from "ethers";
import fs from "fs";
import { getCiSignerAddress } from "../../test/utils/signers";

// Load frozen fixture - no runtime regeneration
const FIXTURE = JSON.parse(fs.readFileSync("pricing-fixtures/ACME-LLC-30-frozen.json","utf8"));

describe("CDS Swap – E2E (replay)", () => {
  it("settles with replayed signed quote", async () => {
    const portfolioId = keccak256(toUtf8Bytes(FIXTURE.obligorId));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address); await engine.waitForDeployment();

    // Deploy MockPriceOracleAdapter with the CI signer
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracleAdapter");
    const ciSignerAddress = getCiSignerAddress();
    const mockOracle = await MockPriceOracle.deploy(ciSignerAddress);
    await mockOracle.waitForDeployment();
    
    // set oracle adapter
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    
    // 1) Ensure oracle == CI signer
    expect((await mockOracle.riskOracle()).toLowerCase()).to.equal(ciSignerAddress.toLowerCase());
    
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
      correlationBps: FIXTURE.correlationBps
    });
    const receipt = await proposeTx.wait();
    const swapId = receipt.logs.find((log: any) => 
      log.fragment?.name === "SwapProposed"
    ).args.swapId;
    await engine.activateSwap(swapId);

    // 2) Ensure chain time is inside freshness window and after swap start
    const currentTime = await time.latest();
    const quoteTarget = Number(FIXTURE.asOf) + 60;              // a little after asOf
    const swapTarget = START + 24 * 60 * 60;                    // 1 day after swap start
    const target = Math.max(quoteTarget, swapTarget);           // whichever is later
    
    if (currentTime < BigInt(target)) {
      await time.increaseTo(target);
    }
    
    // 3) (Optional but helpful) sanity: engine.verifyQuote must pass
    const ok = await engine.verifyQuote(
      {
        fairSpreadBps: FIXTURE.fairSpreadBps,
        correlationBps: FIXTURE.correlationBps,
        asOf: FIXTURE.asOf,
        riskScore: FIXTURE.riskScore,
        modelIdHash: FIXTURE.modelIdHash,
        featuresHash: FIXTURE.featuresHash,
        digest: FIXTURE.digest,
        signature: FIXTURE.signature
      },
      portfolioId
    );
    expect(ok).to.equal(true);

    const settleTx = await engine.settleSwap(swapId, {
      fairSpreadBps: FIXTURE.fairSpreadBps,
      correlationBps: FIXTURE.correlationBps,
      asOf: FIXTURE.asOf,
      riskScore: FIXTURE.riskScore,
      modelIdHash: FIXTURE.modelIdHash,
      featuresHash: FIXTURE.featuresHash,
      digest: FIXTURE.digest,
      signature: FIXTURE.signature
    });
    await settleTx.wait();

    const meta = await engine.swaps(swapId);
   expect(meta.status).to.equal(2); // Settled
  });
});
