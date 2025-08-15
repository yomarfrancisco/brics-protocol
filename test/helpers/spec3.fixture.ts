import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { USDC } from "../utils/units";
import { setNavCompat } from "../utils/nav-helpers";
import { navRayFor1to1 } from "../utils/nav-math";

export async function deploySpec3Fixture() {
  const [gov, ops, user] = await ethers.getSigners();

  // Deploy USDC mock and fund actors
  const USDCMock = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDCMock.deploy();
  await usdc.mint(ops.address, USDC("1_000_000"));

  // Deploy NAV Oracle
  const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
  const navOracle = await MockNAVOracle.deploy();

  // Deploy Member Registry
  const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
  const memberRegistry = await MemberRegistry.deploy(gov.address);

  // Deploy Config Registry
  const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
  const configRegistry = await ConfigRegistry.deploy(gov.address);

  // Deploy mock treasury
  const TreasuryLiquidityMock = await ethers.getContractFactory("TreasuryLiquidityMock");
  const treasury = await TreasuryLiquidityMock.deploy(usdc);

  // Deploy PreTrancheBuffer
  const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
  const preTrancheBuffer = await PreTrancheBuffer.deploy(
    gov.address, 
    usdc.target, 
    memberRegistry.target, 
    configRegistry.target
  );

  // Deploy RedemptionClaim
  const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
  const redemptionClaim = await RedemptionClaim.deploy(
    gov.address,
    memberRegistry.target,
    configRegistry.target
  );

  // Deploy BRICS Token
  const BRICSToken = await ethers.getContractFactory("BRICSToken");
  const bricsToken = await BRICSToken.deploy(gov.address, memberRegistry.target);

  // Deploy mock TrancheManager for SPEC §3 testing
  const TrancheManagerV2Mock = await ethers.getContractFactory("TrancheManagerV2Mock");
  const trancheManager = await TrancheManagerV2Mock.deploy(ethers.parseEther("1000000000")); // huge cap

  // Deploy Claim Registry
  const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy(gov.address);

  // Deploy IssuanceControllerV3 with mock treasury
  const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
  const issuanceController = await IssuanceControllerV3.deploy(
    gov.address,
    bricsToken.target,
    trancheManager.target,
    configRegistry.target,
    navOracle.target,
    usdc.target,
    treasury.target,
    redemptionClaim.target,
    preTrancheBuffer.target,
    claimRegistry.target
  );

  // Grant roles
  await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), issuanceController.target);
  await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), issuanceController.target);
  await issuanceController.connect(gov).grantRole(await issuanceController.OPS_ROLE(), ops.address);

  // Configure member registry
  await memberRegistry.connect(gov).setRegistrar(gov.address);
  await memberRegistry.connect(gov).setMember(user.address, true);

  // Configure config registry
  await configRegistry.connect(gov).grantRole(await configRegistry.GOV_ROLE(), gov.address);
  
  // Put controller in GREEN with zero instant buffer so legacy IRB gate is neutralized
  await configRegistry.connect(gov).setEmergencyParams(0, { // EmergencyLevel.NORMAL
    ammMaxSlippageBps: 50,
    instantBufferBps: 0,       // neutralizes legacy minIRB
    maxIssuanceRateBps: 10000, // 100%
    maxDetachmentBps: 10300
  });

  // Set NAV to 1:1 and bypass jump guard
  await navOracle.setEmergency(true);
  await setNavCompat(navOracle, navRayFor1to1);

  // Deterministic IRB: set target low, then you can raise/lower in tests
  await treasury.setIRBTarget(USDC("0"));
  await usdc.mint(treasury.target, USDC("1_000_000"));

  // Sovereign code for testing
  const SOVEREIGN_CODE = ethers.keccak256(ethers.toUtf8Bytes("TEST_SOVEREIGN"));

  return { 
    gov, 
    ops, 
    user, 
    issuanceController, 
    usdc, 
    navOracle, 
    configRegistry, 
    bricsToken, 
    treasury, 
    SOVEREIGN_CODE 
  };
}
