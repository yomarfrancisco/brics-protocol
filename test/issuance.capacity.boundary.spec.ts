import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { calcEffectiveCapTokens } from "./utils/cap";

describe("SPEC §3 — Capacity boundary", () => {
  let gov: Signer, ops: Signer, user: Signer;
  let govAddr: string, opsAddr: string, userAddr: string;

  let usdc: Contract;
  let oracle: Contract;
  let member: Contract;
  let config: Contract;
  let brics: Contract;
  let tranche: Contract;
  let treasury: Contract;
  let preBuffer: Contract;
  let claim: Contract;
  let claimReg: Contract;
  let ic: Contract;

  const SOV = ethers.encodeBytes32String("TEST_SOV");

  beforeEach(async () => {
    [gov, ops, user] = await ethers.getSigners();
    [govAddr, opsAddr, userAddr] = await Promise.all([
      gov.getAddress(), ops.getAddress(), user.getAddress()
    ]);

    // Deploy mocks/internals
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    oracle = await MockNAVOracle.deploy();
    await oracle.setNAV(ethers.parseEther("1"));

    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    member = await MemberRegistry.deploy(govAddr);
    await member.connect(gov).setRegistrar(govAddr);
    await member.connect(gov).setMember(userAddr, true);

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    config = await ConfigRegistry.deploy(govAddr);
    await config.connect(gov).grantRole(await config.GOV_ROLE(), govAddr);

    // Sovereign config: util=8000 (80%), haircut=2000 (20%), weight=5000 (50%), enabled=true
    await config.connect(gov).addSovereign(
      SOV,            // code
      8_000,          // utilCapBps
      2_000,          // haircutBps
      5_000,          // weightBps
      true            // enabled
    );

    // soft/hard caps in USDC-6 units (1m / 2m)
    const softCap = ethers.parseUnits("1000000", 6);
    const hardCap = ethers.parseUnits("2000000", 6);

    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(govAddr, await usdc.getAddress(), 300);

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    preBuffer = await PreTrancheBuffer.deploy(govAddr, await usdc.getAddress(), await member.getAddress(), await config.getAddress());

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    brics = await BRICSToken.deploy(govAddr, await member.getAddress());

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    claim = await RedemptionClaim.deploy(govAddr, await member.getAddress(), await config.getAddress());

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    tranche = await TrancheManagerV2.deploy(govAddr, await oracle.getAddress(), await config.getAddress());
    await tranche.connect(gov).adjustSuperSeniorCap(ethers.parseEther("10000000"));

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    claimReg = await ClaimRegistry.deploy(govAddr);

    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    ic = await IssuanceControllerV3.deploy(
      govAddr,
      await brics.getAddress(),
      await tranche.getAddress(),
      await config.getAddress(),
      await oracle.getAddress(),
      await usdc.getAddress(),
      await treasury.getAddress(),
      await claim.getAddress(),
      await preBuffer.getAddress(),
      await claimReg.getAddress()
    );

    // Roles
    await brics.connect(gov).grantRole(await brics.MINTER_ROLE(), await ic.getAddress());
    await ic.connect(gov).grantRole(await ic.OPS_ROLE(), opsAddr);
    
    // Set sovereign caps after IC is deployed
    await ic.connect(gov).setSovereignCap(SOV, softCap, hardCap);

    // Fund treasury and ops so issuance path is unconstrained by liquidity
    await usdc.mint(await treasury.getAddress(), ethers.parseUnits("5000000", 6));
    await usdc.mint(opsAddr, ethers.parseUnits("1000000", 6));
    await usdc.connect(ops).approve(await ic.getAddress(), ethers.parseUnits("1000000", 6));
  });

  it("mints exactly at effective cap (pass) and +1 wei (revert)", async () => {
    // Calculate effective cap using the debug function
    const debug = await ic.getSovereignCapacityDebug(SOV);
    const capUSDC = debug.capUSDC;



    // Happy path: exactly remaining cap
    await expect(ic.connect(ops).mintFor(userAddr, debug.remUSDC, 0, 0, SOV))
      .to.emit(brics, "Transfer"); // mint succeeded

    // Boundary: +1 wei must revert with cap error
    await expect(ic.connect(ops).mintFor(userAddr, debug.remUSDC + 1n, 0, 0, SOV))
      .to.be.reverted; // Prefer .to.be.revertedWithCustomError(ic, "CapExceeded") if exact name
  });
});
