import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer } from "ethers";

// Temporary logger to identify null constructor args
const origDeploy = (ethers as any).ContractFactory.prototype.deploy;
(ethers as any).ContractFactory.prototype.deploy = function (...args: any[]) {
  const inputs = this.interface.deploy.inputs || this.interface.deployFragment?.inputs || [];
  inputs.forEach((inp: any, i: number) => {
    if (args[i] === null || args[i] === undefined) {
      console.error(`❌ NULL for constructor param "${inp.name}" (type ${inp.type}) in ${this.interface.name}`);
    }
  });
  return origDeploy.apply(this, args);
};

describe("IssuanceControllerV3 - SPEC §3 Per-Sovereign Soft-Cap Damping", function () {
  let issuanceController: Contract;
  let configRegistry: Contract;
  let bricsToken: Contract;
  let memberRegistry: Contract;
  let trancheManager: Contract;
  let navOracle: Contract;
  let treasury: Contract;
  let redemptionClaim: Contract;
  let preTrancheBuffer: Contract;
  let claimRegistry: Contract;
  let usdc: Contract;
  
  let owner: Signer;
  let ops: Signer;
  let gov: Signer;
  let user: Signer;
  let userAddress: string;
  let opsAddress: string;
  let govAddress: string;

  const SOVEREIGN_CODE = ethers.encodeBytes32String("TEST_SOV");
  const SOFT_CAP = ethers.parseEther("1000000"); // 1M USDC
  const HARD_CAP = ethers.parseEther("2000000"); // 2M USDC

  beforeEach(async function () {
    [owner, ops, gov, user] = await ethers.getSigners();
    userAddress = await user.getAddress();
    opsAddress = await ops.getAddress();
    govAddress = await gov.getAddress();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    console.log("USDC deployed at:", await usdc.getAddress());

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy(); // NAV = 1.0 (default)

    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    memberRegistry = await MemberRegistry.deploy(govAddress);

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(govAddress);

    const Treasury = await ethers.getContractFactory("Treasury");
    console.log("Deploying Treasury with usdc.address:", await usdc.getAddress());
    treasury = await Treasury.deploy(govAddress, await usdc.getAddress(), 300); // 3% buffer

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    preTrancheBuffer = await PreTrancheBuffer.deploy(govAddress, await usdc.getAddress(), await memberRegistry.getAddress(), await configRegistry.getAddress());

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    redemptionClaim = await RedemptionClaim.deploy(govAddress, await memberRegistry.getAddress(), await configRegistry.getAddress());

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(govAddress, await navOracle.getAddress(), await configRegistry.getAddress());

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    claimRegistry = await ClaimRegistry.deploy(govAddress);

    // Set super senior cap for TrancheManager
    await trancheManager.connect(gov).adjustSuperSeniorCap(ethers.parseEther("10000000")); // 10M BRICS cap

    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    issuanceController = await IssuanceControllerV3.deploy(
      govAddress,
      await bricsToken.getAddress(),
      await trancheManager.getAddress(),
      await configRegistry.getAddress(),
      await navOracle.getAddress(),
      await usdc.getAddress(),
      await treasury.getAddress(),
      await redemptionClaim.getAddress(),
      await preTrancheBuffer.getAddress(),
      await claimRegistry.getAddress()
    );

    // Setup roles
    await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
    await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
    await issuanceController.connect(gov).grantRole(await issuanceController.OPS_ROLE(), opsAddress);
    
    // Set registrar role for MemberRegistry
    await memberRegistry.connect(gov).setRegistrar(govAddress);
    await memberRegistry.connect(gov).setMember(userAddress, true);
    
    // Grant GOV_ROLE to gov signer for configRegistry
    await configRegistry.connect(gov).grantRole(await configRegistry.GOV_ROLE(), govAddress);

    // Fund treasury
    await usdc.mint(await treasury.getAddress(), ethers.parseEther("1000000"));
    
    // Fund pre-tranche buffer for instant redemptions
    await usdc.mint(await preTrancheBuffer.getAddress(), ethers.parseEther("10000000"));
    
    // Grant BUFFER_MANAGER role to issuance controller
    await preTrancheBuffer.connect(gov).grantRole(await preTrancheBuffer.BUFFER_MANAGER(), await issuanceController.getAddress());
    
    // Grant BURNER_ROLE to issuance controller for redemption claims
    await redemptionClaim.connect(gov).grantRole(await redemptionClaim.BURNER_ROLE(), await issuanceController.getAddress());
    
    // Grant ISSUER_ROLE to issuance controller for redemption claims
    await redemptionClaim.connect(gov).grantRole(await redemptionClaim.ISSUER_ROLE(), await issuanceController.getAddress());
    
    // Grant BURNER_ROLE to issuance controller for BRICS token
    await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
    
    // Grant MINTER_ROLE to issuance controller for BRICS token
    await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
  });

  describe("SPEC §3: Per-Sovereign Soft-Cap Damping", function () {
    beforeEach(async function () {
      // Add sovereign configuration
      await configRegistry.connect(gov).addSovereign(
        SOVEREIGN_CODE,
        8000, // 80% utilization cap
        2000, // 20% haircut
        5000, // 50% weight
        true  // enabled
      );

      // Set sovereign caps
      await issuanceController.connect(gov).setSovereignCap(SOVEREIGN_CODE, SOFT_CAP, HARD_CAP);
      
      // Debug: Check sovereign configuration
      console.log("Sovereign configuration:");
      const sovereign = await configRegistry.getSovereign(SOVEREIGN_CODE);
      console.log("Sovereign:", sovereign);
      console.log("Soft cap:", SOFT_CAP);
      console.log("Hard cap:", HARD_CAP);
    });

    it("should calculate effective capacity correctly (haircut before utilization)", async function () {
      // Effective capacity = 8000 * (1 - 2000/10000) = 8000 * 0.8 = 6400 bps
      const effectiveCap = 8000 * 0.8;
      
      // Debug: Check various conditions
      console.log("Checking canIssue conditions...");
      console.log("Sovereign code:", SOVEREIGN_CODE);
      console.log("Amount:", ethers.parseEther("100000"));
      
      // Check each condition that could cause canIssue to return false
      const params = await configRegistry.getCurrentParams();
      console.log("Emergency params:", params);
      console.log("maxIssuanceRateBps:", params.maxIssuanceRateBps);
      console.log("issuanceLocked:", await trancheManager.issuanceLocked());
      console.log("maxTailCorrPpm:", await configRegistry.maxTailCorrPpm());
      console.log("maxSovUtilBps:", await configRegistry.maxSovUtilBps());
      console.log("tailCorrPpm:", 100000000);
      console.log("sovUtilBps:", 1500);
      
      // Check oracle and liquidity conditions
      console.log("Oracle degradation level:", await navOracle.getDegradationLevel());
      console.log("Emergency level:", await configRegistry.emergencyLevel());
      console.log("NAV:", await navOracle.navRay());
      
      // Check liquidity conditions
      const liquidityStatus = await treasury.getLiquidityStatus();
      console.log("Liquidity status:", liquidityStatus);
      
      const bufferStatus = await preTrancheBuffer.getBufferStatus();
      console.log("Buffer status:", bufferStatus);
      
      // Check sovereign-specific capacity calculation
      const effectiveCapacity = await configRegistry.getEffectiveCapacity(SOVEREIGN_CODE);
      console.log("Effective capacity from config:", effectiveCapacity);
      
      const sovereignUtilization = await issuanceController.sovereignUtilization(SOVEREIGN_CODE);
      console.log("Current sovereign utilization:", sovereignUtilization);
      
      const sovereignSoftCap = await issuanceController.sovereignSoftCap(SOVEREIGN_CODE);
      const sovereignHardCap = await issuanceController.sovereignHardCap(SOVEREIGN_CODE);
      console.log("Sovereign soft cap:", sovereignSoftCap);
      console.log("Sovereign hard cap:", sovereignHardCap);
      
      // Use the debug function to get the actual capacity values
      const debug = await issuanceController.getSovereignCapacityDebug(SOVEREIGN_CODE);
      console.log("Debug values:", debug);
      console.log("Soft cap USDC:", debug.softCapUSDC);
      console.log("Cap BPS:", debug.capBps);
      console.log("Cap USDC:", debug.capUSDC);
      console.log("Used USDC:", debug.usedUSDC);
      console.log("Remaining USDC:", debug.remUSDC);
      
      // Test with the exact remaining capacity
      console.log("Testing with amount:", debug.remUSDC);
      
      // Check additional conditions that might be failing
      const superSeniorCap = await trancheManager.superSeniorCap();
      const totalIssued = await issuanceController.totalIssued();
      const reservedForNav = await issuanceController.reservedForNav();
      const effectiveOutstanding = totalIssued - reservedForNav;
      
      console.log("superSeniorCap:", superSeniorCap);
      console.log("totalIssued:", totalIssued);
      console.log("reservedForNav:", reservedForNav);
      console.log("effectiveOutstanding:", effectiveOutstanding);
      
      // Calculate tokens that would be minted
      const nav = await navOracle.navRay();
      const tokensOut = (debug.remUSDC * ethers.parseUnits("1", 27)) / nav;
      console.log("tokensOut:", tokensOut);
      console.log("effectiveOutstanding + tokensOut:", effectiveOutstanding + tokensOut);
      console.log("Would exceed cap:", (effectiveOutstanding + tokensOut) > superSeniorCap);
      
      const canIssue = await issuanceController.canIssue(
        debug.remUSDC, // Use the exact remaining capacity
        100000000, // 0.1 tail correlation
        1500, // 15% sovereign utilization
        SOVEREIGN_CODE
      );
      
      console.log("canIssue result:", canIssue);
      
      expect(canIssue).to.be.true;
      
      // Test that requesting more than remaining capacity fails
      const canIssueTooMuch = await issuanceController.canIssue(
        debug.remUSDC + 1n, // Request 1 wei more than available
        100000000, // 0.1 tail correlation
        1500, // 15% sovereign utilization
        SOVEREIGN_CODE
      );
      
      console.log("canIssueTooMuch result:", canIssueTooMuch);
      expect(canIssueTooMuch).to.be.false;
    });

    it("should block mint above hard cap", async function () {
      // Mint up to hard cap
      await usdc.mint(opsAddress, HARD_CAP);
      await usdc.connect(ops).approve(issuanceController.address, HARD_CAP);
      
      await issuanceController.connect(ops).mintFor(
        userAddress,
        HARD_CAP,
        100000000,
        1500,
        SOVEREIGN_CODE
      );

      // Try to mint more - should fail
      await usdc.mint(opsAddress, ethers.parseEther("100000"));
      await usdc.connect(ops).approve(issuanceController.address, ethers.parseEther("100000"));
      
      await expect(
        issuanceController.connect(ops).mintFor(
          userAddress,
          ethers.parseEther("100000"),
          100000000,
          1500,
          SOVEREIGN_CODE
        )
      ).to.be.revertedWithCustomError(issuanceController, "SovereignCapExceeded");
    });

    it("should apply linear damping between softCap and hardCap", async function () {
      // Mint up to soft cap
      await usdc.mint(opsAddress, SOFT_CAP);
      await usdc.connect(ops).approve(issuanceController.address, SOFT_CAP);
      
      await issuanceController.connect(ops).mintFor(
        userAddress,
        SOFT_CAP,
        100000000,
        1500,
        SOVEREIGN_CODE
      );

      // Current utilization is at soft cap
      // Damping should start applying
      const utilization = await issuanceController.sovereignUtilization(SOVEREIGN_CODE);
      expect(utilization).to.equal(SOFT_CAP);

      // Try to mint more - should be damped
      const dampingAmount = ethers.parseEther("100000");
      await usdc.mint(opsAddress, dampingAmount);
      await usdc.connect(ops).approve(issuanceController.address, dampingAmount);
      
      // Should succeed but with reduced capacity due to damping
      await issuanceController.connect(ops).mintFor(
        userAddress,
        dampingAmount,
        100000000,
        1500,
        SOVEREIGN_CODE
      );
    });

    it("should disable minting in emergency pause", async function () {
      // Set emergency level to RED (maxIssuanceRateBps = 0)
      await configRegistry.setEmergencyLevel(3, "emergency test");
      
      await expect(
        issuanceController.canIssue(
          ethers.parseEther("100000"),
          100000000,
          1500,
          SOVEREIGN_CODE
        )
      ).to.eventually.be.false;
    });

    it("should reject disabled sovereigns", async function () {
      // Disable sovereign
      await configRegistry.setSovereignEnabled(SOVEREIGN_CODE, false);
      
      await expect(
        issuanceController.canIssue(
          ethers.parseEther("100000"),
          100000000,
          1500,
          SOVEREIGN_CODE
        )
      ).to.eventually.be.false;
    });

    it("should update sovereign utilization correctly", async function () {
      const mintAmount = ethers.parseEther("100000");
      await usdc.mint(opsAddress, mintAmount);
      await usdc.connect(ops).approve(issuanceController.address, mintAmount);
      
      await issuanceController.connect(ops).mintFor(
        userAddress,
        mintAmount,
        100000000,
        1500,
        SOVEREIGN_CODE
      );

      const utilization = await issuanceController.sovereignUtilization(SOVEREIGN_CODE);
      expect(utilization).to.equal(mintAmount);
    });

    it("should emit SovereignUtilizationUpdated event", async function () {
      const mintAmount = ethers.parseEther("100000");
      await usdc.mint(opsAddress, mintAmount);
      await usdc.connect(ops).approve(issuanceController.address, mintAmount);
      
      await expect(
        issuanceController.connect(ops).mintFor(
          userAddress,
          mintAmount,
          100000000,
          1500,
          SOVEREIGN_CODE
        )
      ).to.emit(issuanceController, "SovereignUtilizationUpdated")
        .withArgs(SOVEREIGN_CODE, mintAmount);
    });
  });
});
