import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";
import { readFileSync } from "fs";

const FIX = "pricing-fixtures/ACME-LLC-30-1700000000.json";

describe("CDS Swap – E2E (replay)", () => {
  it("settles with replayed signed quote", async () => {
    const f = JSON.parse(readFileSync(FIX, "utf8"));
    const portfolioId = keccak256(toUtf8Bytes(f.obligorId));

    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(); await engine.waitForDeployment();
    const [gov, buyer, seller] = await ethers.getSigners();

    // set oracle signer (adapter compare is internal; we verify recovered matches signer)
    await engine.connect(gov).setPriceOracle(gov.address);

    const now = f.asOf;
    const notional = 1_000_000n;
    await engine.proposeSwap({
      portfolioId,
      protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(now), maturity: BigInt(now + 30*86400) },
      protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(now), maturity: BigInt(now + 30*86400) },
      correlationBps: f.correlationBps
    });
    const swapId = await engine.swapIds(0);
    await engine.activateSwap(swapId);

    const tx = await engine.settleSwap(swapId, {
      fairSpreadBps: f.fairSpreadBps,
      correlationBps: f.correlationBps,
      asOf: f.asOf,
      riskScore: f.riskScore,
      modelIdHash: f.modelIdHash,
      featuresHash: f.featuresHash,
      signature: f.signature
    });
    await tx.wait();

    const meta = await engine.swaps(swapId);
   expect(meta.status).to.equal(2); // Settled
  });
});
