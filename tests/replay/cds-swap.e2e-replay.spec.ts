import hre from "hardhat";
import { expect } from "chai";
import FIXTURE from "../../pricing-fixtures/ACME-LLC-30-frozen.json";
import { getCiSignerAddress } from "../../test/utils/signers";

describe("CDS Swap – E2E (replay)", () => {
  it("verifies quote and runs swap deterministically", async () => {
    const portfolioId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ACME-LLC"));

    const [gov, buyer, seller] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CdsSwapEngine");
    const engine = await Engine.deploy(gov.address); await engine.waitForDeployment();

    // Deploy MockPriceOracleAdapter with the CI signer
    const MockPriceOracle = await hre.ethers.getContractFactory("MockPriceOracleAdapter");
    const ciSignerAddress = await getCiSignerAddress(hre);
    const mockOracle = await MockPriceOracle.deploy(ciSignerAddress);
    await mockOracle.waitForDeployment();
    
    // set oracle adapter
    await engine.connect(gov).setPriceOracle(await mockOracle.getAddress());
    
    // 1) Ensure oracle == CI signer
    expect((await mockOracle.riskOracle()).toLowerCase()).to.equal(ciSignerAddress.toLowerCase());
    
    // Grant BROKER_ROLE to gov for testing
    const BROKER_ROLE = await engine.BROKER_ROLE();
    await engine.connect(gov).grantRole(BROKER_ROLE, gov.address);

    // Use fixture timestamp for deterministic testing
    const currentTime = Math.floor(Date.now() / 1000);
    const START = Math.max(FIXTURE.asOf + 60, currentTime + 60); // start after fixture asOf and current time
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

    // 2) Verify recovered signer == pinned CI signer
    const quote = {
      fairSpreadBps: FIXTURE.fairSpreadBps,
      correlationBps: FIXTURE.correlationBps,
      asOf: FIXTURE.asOf,
      riskScore: FIXTURE.riskScore,
      modelIdHash: FIXTURE.modelIdHash,
      featuresHash: FIXTURE.featuresHash,
      digest: FIXTURE.digest,
      signature: FIXTURE.signature,
    };

    // Verify recovered signer == pinned CI signer
    const expectedSigner = await getCiSignerAddress(hre);
    const recovered = hre.ethers.verifyMessage(hre.ethers.getBytes(quote.digest), quote.signature);
    expect(recovered).to.equal(expectedSigner);

    // 3) Advance time to when quote is fresh and swap has started
    const quoteFreshUntil = quote.asOf + 300; // QUOTE_STALE_SECONDS = 300
    const swapStartTime = START;
    const targetTime = Math.max(quoteFreshUntil - 60, swapStartTime + 60); // 1 minute before quote expires, 1 minute after swap starts
    await hre.network.provider.send("evm_setNextBlockTimestamp", [targetTime]);
    await hre.network.provider.send("evm_mine");
    
    // 4) Now verify on-chain
    const ok = await engine.verifyQuote(quote, portfolioId);
    expect(ok).to.equal(true);

    // 5) Proceed with swap lifecycle checks
    const settleTx = await engine.settleSwap(swapId, quote);
    await settleTx.wait();

    const meta = await engine.swaps(swapId);
    expect(meta.status).to.equal(2); // Settled
  });
});
