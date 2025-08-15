// test/helpers/mint-happy.fixture.ts
import { ethers } from "hardhat";
import { USDC } from "../utils/units"; // already exists from prior work
import { setNavCompat } from "../utils/nav-helpers";

async function grant(role: string, account: string, controller: any) {
  const has = await controller.hasRole(role, account);
  if (!has) await controller.grantRole(role, account);
}

export async function mintHappyFixture() {
  const [gov, ops, to, treasuryEOA] = await ethers.getSigners();

  // Replace factories with the actual mocks used in your repo if names differ
  const USDCMock = await ethers.getContractFactory("MockUSDC");          // 6d
  const Token    = await ethers.getContractFactory("BRICSToken");
  const TM       = await ethers.getContractFactory("TrancheManagerV2");
  const Cfg      = await ethers.getContractFactory("ConfigRegistry");
  const Oracle   = await ethers.getContractFactory("MockNAVOracle");      // must expose navRay(), getDegradationLevel(), getCurrentHaircutBps()
  const Treasury = await ethers.getContractFactory("Treasury");
  const Claims   = await ethers.getContractFactory("RedemptionClaim");
  const Buffer   = await ethers.getContractFactory("PreTrancheBuffer");
  const ClaimReg = await ethers.getContractFactory("ClaimRegistry");

  const usdc     = await USDCMock.deploy();                                await usdc.waitForDeployment();
  const memberRegistry = await ethers.getContractFactory("MockMemberRegistry").then(f => f.deploy());
  await memberRegistry.waitForDeployment();
  const token    = await Token.deploy(gov.address, await memberRegistry.getAddress());                     await token.waitForDeployment();
  const cfg      = await Cfg.deploy(gov.address);                                       await cfg.waitForDeployment();
  const tm       = await TM.deploy(gov.address, await ethers.getContractFactory("MockNAVOracle").then(o => o.deploy()).then(o => o.getAddress()), await cfg.getAddress());                                        await tm.waitForDeployment();
  const oracle   = await Oracle.deploy();                                    await oracle.waitForDeployment();
  const treasury = await Treasury.deploy(gov.address, await usdc.getAddress(), 300);  await treasury.waitForDeployment();
  const claims   = await Claims.deploy(gov.address, await memberRegistry.getAddress(), await cfg.getAddress());    await claims.waitForDeployment();
  const preBuf   = await Buffer.deploy(gov.address, await usdc.getAddress(), await memberRegistry.getAddress(), await cfg.getAddress());        await preBuf.waitForDeployment();
  const cReg     = await ClaimReg.deploy(gov.address);                                  await cReg.waitForDeployment();

  const Controller = await ethers.getContractFactory("IssuanceControllerV3");
  const controller = await Controller.deploy(
    gov.address,
    await token.getAddress(),
    await tm.getAddress(),
    await cfg.getAddress(),
    await oracle.getAddress(),
    await usdc.getAddress(),
    await treasury.getAddress(),
    await claims.getAddress(),
    await preBuf.getAddress(),
    await cReg.getAddress()
  );
  await controller.waitForDeployment();

  // Roles
  const OPS = await controller.OPS_ROLE();
  const GOV = await controller.GOV_ROLE();
  await grant(GOV, gov.address, controller);
  await grant(OPS, ops.address, controller);

  // Unlock + huge caps
  if (tm.setIssuanceLocked) await tm.setIssuanceLocked(false);
  if (tm.adjustSuperSeniorCap) await tm.adjustSuperSeniorCap(ethers.parseEther("1000000000"));

  // Config: GREEN state, full issuance rate, generous limits
  if (cfg.setEmergencyLevel)       await cfg.setEmergencyLevel(0, "test");        // GREEN
  if (cfg.setMaxIssuanceRateBps)   await cfg.setMaxIssuanceRateBps(10000);        // 100% issuance rate for happy path
  if (cfg.setMaxTailCorrPpm)       await cfg.setMaxTailCorrPpm(1_000_000_000);
  if (cfg.setMaxSovUtilBps)        await cfg.setMaxSovUtilBps(10_000);

  // Sovereign capacity generous
  const SOVEREIGN_CODE = ethers.encodeBytes32String("ZA");
  if (cfg.addSovereign)
    await cfg.addSovereign(SOVEREIGN_CODE, 8000, 2000, 5000, true); // 80% util cap, 20% haircut, 50% weight, enabled
  if (controller.setSovereignCap)
    await controller.setSovereignCap(SOVEREIGN_CODE, USDC("1000000"), USDC("2000000"));

  // Oracle healthy
  await setNavCompat(oracle, ethers.parseUnits("1.00", 27));
  if (oracle.setDegradationLevel)          await oracle.setDegradationLevel(0);
  if (oracle.setCurrentHaircutBps)         await oracle.setCurrentHaircutBps(0);

  // Sovereign guarantee (only used in RED, but make available if mock supports it)
  if ((cReg as any).setSovereignGuaranteeAvailable)
    await (cReg as any).setSovereignGuaranteeAvailable(true);

  // Fund treasury with USDC to ensure liquidity is OK
  await usdc.mint(await treasury.getAddress(), USDC("10000"));

  // Fund OPS with USDC and approve controller
  await usdc.mint(ops.address, USDC("1000"));
  await usdc.connect(ops).approve(await controller.getAddress(), USDC("1000"));
  
  // Add recipient to member registry so they can receive tokens
  if (memberRegistry.setMember) {
    await memberRegistry.setMember(to.address, true);
    // Also add controller as member in case it needs to send tokens
    await memberRegistry.setMember(await controller.getAddress(), true);
  }

  // Give controller minting rights on BRICS token if role-gated
  if ((token as any).MINTER_ROLE && (token as any).grantRole) {
    const MINTER = await (token as any).MINTER_ROLE();
    await (token as any).grantRole(MINTER, await controller.getAddress());
  }

  return { controller, usdc, token, cfg, oracle, tm, treasury, preBuf, cReg, ops, to, SOVEREIGN_CODE, memberRegistry };
}
