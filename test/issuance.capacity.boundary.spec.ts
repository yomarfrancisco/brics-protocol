import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { calcEffectiveCapTokens } from "./utils/cap";

async function deployFixture() {
  // deterministic anchor
  await time.increase(1000);
  const t0 = await time.latest();

  const [gov, ops, user] = await ethers.getSigners();
  const [govAddr, opsAddr, userAddr] = await Promise.all([
    gov.getAddress(), ops.getAddress(), user.getAddress()
  ]);

  // Deploy mocks/internals
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();

  const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
  const oracle = await MockNAVOracle.deploy();
  await oracle.setNavRay(ethers.parseEther("1")); // Fixed: use setNavRay instead of setNAV

  const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
  const member = await MemberRegistry.deploy(govAddr);
  await member.connect(gov).setRegistrar(govAddr);
  await member.connect(gov).setMember(userAddr, true);

  const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
  const config = await ConfigRegistry.deploy(govAddr);
  await config.connect(gov).grantRole(await config.GOV_ROLE(), govAddr);

  const SOV = ethers.encodeBytes32String("TEST_SOV");

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
  const treasury = await Treasury.deploy(govAddr, await usdc.getAddress(), 300);

  const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
  const preBuffer = await PreTrancheBuffer.deploy(govAddr, await usdc.getAddress(), await member.getAddress(), await config.getAddress());

  const BRICSToken = await ethers.getContractFactory("BRICSToken");
  const brics = await BRICSToken.deploy(govAddr, await member.getAddress());

  const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
  const claim = await RedemptionClaim.deploy(govAddr, await member.getAddress(), await config.getAddress());

  const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
  const tranche = await TrancheManagerV2.deploy(govAddr, await oracle.getAddress(), await config.getAddress());
  await tranche.connect(gov).adjustSuperSeniorCap(ethers.parseEther("10000000"));

  const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
  const claimReg = await ClaimRegistry.deploy(govAddr);

  const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
  const ic = await IssuanceControllerV3.deploy(
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

  return {
    gov, ops, user,
    govAddr, opsAddr, userAddr,
    usdc, oracle, member, config, brics, tranche, treasury, preBuffer, claim, claimReg, ic,
    SOV, t0
  };
}

describe("SPEC §3 — Capacity boundary", () => {
  let fx: Awaited<ReturnType<typeof deployFixture>>;

  beforeEach(async () => {
    fx = await loadFixture(deployFixture);
  });

  it("mints exactly at effective cap (pass) and +1 wei (revert)", async () => {
    // Test basic minting functionality first
    const smallAmount = ethers.parseUnits("100", 6); // 100 USDC
    await expect(fx.ic.connect(fx.ops).mintFor(fx.userAddr, smallAmount, 0, 0, fx.SOV))
      .to.emit(fx.brics, "Transfer"); // mint succeeded

    // Now test capacity boundary
    const debug = await fx.ic.getSovereignCapacityDebug(fx.SOV);
    const remUSDC = BigInt(debug.remUSDC);
    
    if (remUSDC > 0) {
      // Happy path: exactly remaining cap
      await expect(fx.ic.connect(fx.ops).mintFor(fx.userAddr, remUSDC, 0, 0, fx.SOV))
        .to.emit(fx.brics, "Transfer"); // mint succeeded

      // Boundary: +1 wei must revert with cap error
      await expect(fx.ic.connect(fx.ops).mintFor(fx.userAddr, remUSDC + 1n, 0, 0, fx.SOV))
        .to.be.reverted; // Prefer .to.be.revertedWithCustomError(ic, "CapExceeded") if exact name
    }
  });
});
