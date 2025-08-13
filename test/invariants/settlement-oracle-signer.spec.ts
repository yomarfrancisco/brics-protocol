import { expect } from "chai";
import { ethers } from "hardhat";
import { AbiCoder, keccak256, toUtf8Bytes, getBytes, Wallet } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getCiSignerAddress } from "../utils/signers";

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

    const digest = keccak256(coder.encode(
      ["bytes32","uint64","uint256","uint16","uint16","bytes32","bytes32"],
      [portfolioId, asOf, risk, corr, fair, modelIdHash, featuresHash]
    ));

    const bad = Wallet.createRandom().connect(ethers.provider);
    const badSig = await bad.signMessage(getBytes(digest));

    await expect(engine.settleSwap(swapId, {
      fairSpreadBps: fair,
      correlationBps: corr,
      asOf,
      riskScore: risk,
      modelIdHash,
      featuresHash,
      digest,
      signature: badSig
    })).to.be.reverted;
  });
});

