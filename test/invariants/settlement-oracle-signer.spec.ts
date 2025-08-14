import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes, Wallet } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getCiSignerAddress } from "../utils/signers";
import { signDigestEip191 } from "../utils/signing";

describe("Invariant: settlement requires oracle signer", () => {
  it("reverts when signature is from non-oracle signer", async () => {
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

    // Propose & activate a swap
    const now = await time.latest();
    const START = Number(now) + 60;
    const MATURITY = START + 30 * 24 * 60 * 60;
    const notional = 1_000_000n;

    const tx = await engine.proposeSwap({
      portfolioId: keccak256(toUtf8Bytes("ACME-LLC")),
      protectionBuyer:  { counterparty: buyer.address,  notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },

      protectionSeller: { counterparty: seller.address, notional, spreadBps: 80, start: BigInt(START), maturity: BigInt(MATURITY) },

      correlationBps: 2000
    });
    const receipt = await tx.wait();
    const swapId = receipt.logs.find((l:any)=>l.fragment?.name==="SwapProposed").args.swapId;

    await engine.activateSwap(swapId);
    await time.increaseTo(START + 24*60*60);

    // Create a quote and sign with a NON-oracle signer
    const coder = new AbiCoder();
    const portfolioId = keccak256(toUtf8Bytes("ACME-LLC"));
    const asOf = Number(await time.latest());
    const risk = 123n;
    const corr = 1111;
    const fair = 222;
    const modelIdHash = keccak256(toUtf8Bytes("MODEL-V1"));
    const featuresHash = keccak256(toUtf8Bytes("{}"));

    // Create payload and digest using RiskSignalLib format
    const payload = {
      portfolioId,
      asOf: BigInt(asOf),
      riskScore: risk,
      correlationBps: corr,
      spreadBps: fair,
      modelIdHash,
      featuresHash
    };

    const digest = keccak256(coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [payload.portfolioId, payload.asOf, payload.riskScore, payload.correlationBps, payload.spreadBps, payload.modelIdHash, payload.featuresHash]
    ));

    // Sign with a NON-oracle signer (bad signer)
    const bad = Wallet.createRandom().connect(ethers.provider);
    const badSig = await signDigestEip191(bad, digest);

    // Calculate elapsed and tenor days
    const elapsedDays = 1; // 1 day after start
    const tenorDays = 30; // 30 day swap

    // Create PriceQuote struct with proper fields
    const quote = {
      fairSpreadBps: fair,
      correlationBps: corr,
      asOf: BigInt(asOf),
      riskScore: risk,
      modelIdHash,
      featuresHash,
      digest,
      signature: badSig
    };

    await expect(engine.settleSwap(swapId, quote, elapsedDays, tenorDays)).to.be.reverted;
  });
});

