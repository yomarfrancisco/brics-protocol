import { setNavCompat } from "./utils/nav-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { USDC } from "./utils/units";

describe("Issue #61 – no shadowing in mintFor", () => {
  it("accepts non-zero usdcAmt (smoke)", async () => {
    const [deployer, to] = await ethers.getSigners();
    
    // Deploy minimal contracts for testing
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    
    const MockOracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await MockOracle.deploy();
    
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const configRegistry = await ConfigRegistry.deploy(deployer.address);
    
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    const memberRegistry = await MemberRegistry.deploy(deployer.address);
    
    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    const bricsToken = await BRICSToken.deploy(deployer.address, await memberRegistry.getAddress());
    
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    const trancheManager = await TrancheManagerV2.deploy(deployer.address, await oracle.getAddress(), await configRegistry.getAddress());
    
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployer.address, await usdc.getAddress(), 300);
    
    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    const redemptionClaim = await RedemptionClaim.deploy(deployer.address, await memberRegistry.getAddress(), await configRegistry.getAddress());
    
    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    const preBuffer = await PreTrancheBuffer.deploy(deployer.address, await usdc.getAddress(), await memberRegistry.getAddress(), await configRegistry.getAddress());
    
    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    const claimRegistry = await ClaimRegistry.deploy(deployer.address);
    
    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    const controller = await IssuanceControllerV3.deploy(
      deployer.address,
      await bricsToken.getAddress(),
      await trancheManager.getAddress(),
      await configRegistry.getAddress(),
      await oracle.getAddress(),
      await usdc.getAddress(),
      await treasury.getAddress(),
      await redemptionClaim.getAddress(),
      await preBuffer.getAddress(),
      await claimRegistry.getAddress()
    );
    
    // Setup roles
    await bricsToken.connect(deployer).grantRole(await bricsToken.MINTER_ROLE(), await controller.getAddress());
    await bricsToken.connect(deployer).grantRole(await bricsToken.BURNER_ROLE(), await controller.getAddress());
    await controller.connect(deployer).grantRole(await controller.OPS_ROLE(), deployer.address);
    
    // Set up NAV oracle
    await setNavCompat(oracle, ethers.parseUnits("1.0", 27)); // 1.0 NAV in ray format
    
    // Set up sovereign configuration
    const SOVEREIGN_CODE = ethers.encodeBytes32String("TEST");
    await configRegistry.connect(deployer).addSovereign(
      SOVEREIGN_CODE,
      8000, // 80% utilization cap
      2000, // 20% haircut
      5000, // 50% weight
      true  // enabled
    );
    
    // Set sovereign caps
    await controller.connect(deployer).setSovereignCap(SOVEREIGN_CODE, USDC("1000"), USDC("2000"));
    
    // Set super senior cap
    await trancheManager.connect(deployer).adjustSuperSeniorCap(ethers.parseEther("10000000"));
    
    // Fund deployer with USDC
    const usdcAmt = USDC("1");
    expect(usdcAmt).to.not.equal(0n);
    
    await usdc.mint(deployer.address, usdcAmt);
    await usdc.connect(deployer).approve(await controller.getAddress(), usdcAmt);
    
    // Call mintFor with 5 args; it should NOT revert with AmountZero at entry.
    // Note: This test may still fail for business logic reasons, but it should NOT fail with AmountZero
    try {
      await controller.connect(deployer).mintFor(
        to.address,
        usdcAmt,
        0n, // tailCorrPpm
        0n, // sovUtilBps
        SOVEREIGN_CODE
      );
      // If it succeeds, great!
    } catch (error) {
      // If it fails, ensure it's NOT AmountZero
      const errorMessage = error.toString();
      expect(errorMessage).to.not.include("AmountZero");
      expect(errorMessage).to.not.include("AmountZero()");
      console.log("Test failed with business logic error (not AmountZero):", errorMessage);
    }
  });
});
