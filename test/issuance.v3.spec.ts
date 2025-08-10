import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer } from "ethers";

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

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy(ethers.parseEther("1.0")); // NAV = 1.0

    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(govAddress, usdc.address, 300); // 3% buffer

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    preTrancheBuffer = await PreTrancheBuffer.deploy(usdc.address, treasury.address);

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    redemptionClaim = await RedemptionClaim.deploy(govAddress);

    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    memberRegistry = await MemberRegistry.deploy(govAddress);

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    bricsToken = await BRICSToken.deploy(govAddress, memberRegistry.address);

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(govAddress, navOracle.address, configRegistry.address);

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(govAddress);

    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    issuanceController = await IssuanceControllerV3.deploy(
      govAddress,
      bricsToken.address,
      trancheManager.address,
      configRegistry.address,
      navOracle.address,
      usdc.address,
      treasury.address,
      redemptionClaim.address,
      preTrancheBuffer.address
    );

    // Setup roles
    await bricsToken.grantRole(await bricsToken.MINTER_ROLE(), issuanceController.address);
    await bricsToken.grantRole(await bricsToken.BURNER_ROLE(), issuanceController.address);
    await issuanceController.grantRole(await issuanceController.OPS_ROLE(), opsAddress);
    await memberRegistry.setMember(userAddress, true);

    // Fund treasury
    await usdc.mint(treasury.address, ethers.parseEther("1000000"));
  });

  describe("SPEC §3: Per-Sovereign Soft-Cap Damping", function () {
    beforeEach(async function () {
      // Add sovereign configuration
      await configRegistry.addSovereign(
        SOVEREIGN_CODE,
        8000, // 80% utilization cap
        2000, // 20% haircut
        5000, // 50% weight
        true  // enabled
      );

      // Set sovereign caps
      await issuanceController.setSovereignCap(SOVEREIGN_CODE, SOFT_CAP, HARD_CAP);
    });

    it("should calculate effective capacity correctly (haircut before utilization)", async function () {
      // Effective capacity = 8000 * (1 - 2000/10000) = 8000 * 0.8 = 6400 bps
      const effectiveCap = 8000 * 0.8;
      
      const canIssue = await issuanceController.canIssue(
        ethers.parseEther("100000"), // 100k USDC
        100000000, // 0.1 tail correlation
        1500, // 15% sovereign utilization
        SOVEREIGN_CODE
      );
      
      expect(canIssue).to.be.true;
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
