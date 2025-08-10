import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("CEI rollback on external failure (settlement path)", () => {
  let gov: Signer, ops: Signer, user: Signer, burner: Signer;
  let govAddr: string, opsAddr: string, userAddr: string, burnerAddr: string;

  let usdc: Contract;
  let oracle: Contract;
  let member: Contract;
  let config: Contract;
  let brics: Contract;
  let tranche: Contract;
  let preBuffer: Contract;
  let claim: Contract;
  let claimReg: Contract;
  let ic: Contract;
  let malTreasury: Contract;

  const SOV = ethers.encodeBytes32String("TEST_SOV");

  beforeEach(async () => {
    [gov, ops, user, burner] = await ethers.getSigners();
    [govAddr, opsAddr, userAddr, burnerAddr] = await Promise.all([
      gov.getAddress(), ops.getAddress(), user.getAddress(), burner.getAddress()
    ]);

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
    await config.connect(gov).addSovereign(SOV, 8_000, 2_000, 5_000, true);

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    preBuffer = await PreTrancheBuffer.deploy(govAddr, await usdc.getAddress(), await member.getAddress(), await config.getAddress());

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    brics = await BRICSToken.deploy(govAddr, await member.getAddress());

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    claim = await RedemptionClaim.deploy(govAddr, await member.getAddress(), await config.getAddress());
    await claim.connect(gov).grantRole(await claim.BURNER_ROLE(), burnerAddr); // burner for settle path

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    tranche = await TrancheManagerV2.deploy(govAddr, await oracle.getAddress(), await config.getAddress());
    await tranche.connect(gov).adjustSuperSeniorCap(ethers.parseEther("10000000"));

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    claimReg = await ClaimRegistry.deploy(govAddr);

    const MalTreasury = await ethers.getContractFactory("MalTreasury");
    malTreasury = await MalTreasury.deploy();

    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    ic = await IssuanceControllerV3.deploy(
      govAddr,
      await brics.getAddress(),
      await tranche.getAddress(),
      await config.getAddress(),
      await oracle.getAddress(),
      await usdc.getAddress(),
      await malTreasury.getAddress(), // <= malicious treasury
      await claim.getAddress(),
      await preBuffer.getAddress(),
      await claimReg.getAddress()
    );

    await brics.connect(gov).grantRole(await brics.MINTER_ROLE(), await ic.getAddress());
    await claim.connect(gov).grantRole(await claim.ISSUER_ROLE(), await ic.getAddress());
    await ic.connect(gov).grantRole(await ic.OPS_ROLE(), opsAddr);
    await ic.connect(gov).grantRole(await ic.BURNER_ROLE(), burnerAddr);
    
    // Set sovereign caps after IC is deployed
    await ic.connect(gov).setSovereignCap(SOV, ethers.parseEther("1000000"), ethers.parseEther("2000000"));

    // Mint user some BRICS and move through NAV flow to create a claim
    // Open window, queue, close, mint claim, strike
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const closeTs = now + 3 * 24 * 3600; // 3 days to satisfy windowMinDuration
    await ic.connect(ops).openNavWindow(closeTs);
    await ic.connect(ops).requestRedeemOnBehalf(userAddr, ethers.parseEther("100"));
    await ethers.provider.send("evm_setNextBlockTimestamp", [closeTs + 1]);
    await ethers.provider.send("evm_mine", []);
    await ic.connect(ops).closeNavWindow();
    await ic.connect(ops).mintClaimsForWindow([userAddr]);
    await ic.connect(ops).strikeRedemption();

    // jump to settlement start (T+5d)
    const window = await ic.currentNavWindow();
    const settleTs = Number(window.strikeTs) + 5 * 24 * 3600 + 1;
    await ethers.provider.send("evm_setNextBlockTimestamp", [settleTs]);
    await ethers.provider.send("evm_mine", []);
  });

  it("settlement reverts (external failure) and state is rolled back", async () => {
    // snapshot state you expect to remain unchanged after revert
    const beforeOutstanding = await ic.totalIssued(); // totalIssued is in IssuanceController
    const claimId = 1;

    await expect(
      ic.connect(burner).settleClaim(1, claimId, userAddr)
    ).to.be.reverted; // Malicious treasury will revert

    const afterOutstanding = await ic.totalIssued();
    expect(afterOutstanding).to.equal(beforeOutstanding);

    // If you keep reservations like reservedForNav/pendingBy, assert they're unchanged:
    // const pending = await ic.pendingOf(userAddr);
    // expect(pending).to.equal(0n); // whatever your expected value is pre-call
  });
});
