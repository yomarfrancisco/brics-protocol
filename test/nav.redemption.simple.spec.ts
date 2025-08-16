import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { getNavRayCompat } from "./utils/nav-helpers";

describe("NAV Redemption Lane - Simple Test", function () {
    async function deployFixture() {
        const [gov, ops] = await ethers.getSigners();
        const govAddress = await gov.getAddress();
        const opsAddress = await ops.getAddress();

        // deterministic chain time
        await time.increase(1000);

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        const configRegistry = await ConfigRegistry.deploy(govAddress);
        await configRegistry.waitForDeployment();

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        const memberRegistry = await MemberRegistry.deploy(govAddress);
        await memberRegistry.waitForDeployment();

        const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
        const navOracle = await MockNAVOracle.deploy();
        await navOracle.waitForDeployment();

        const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
        const claimRegistry = await ClaimRegistry.deploy(govAddress);
        await claimRegistry.waitForDeployment();

        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(govAddress, await mockUSDC.getAddress(), 300);
        await treasury.waitForDeployment();

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        const preTrancheBuffer = await PreTrancheBuffer.deploy(
            govAddress,
            await mockUSDC.getAddress(),
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );
        await preTrancheBuffer.waitForDeployment();

        const BRICSToken = await ethers.getContractFactory("BRICSToken");
        const bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());
        await bricsToken.waitForDeployment();

        const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
        const redemptionClaim = await RedemptionClaim.deploy(
            govAddress,
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );
        await redemptionClaim.waitForDeployment();

        const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
        const trancheManager = await TrancheManagerV2.deploy(
            govAddress,
            await navOracle.getAddress(),
            await configRegistry.getAddress()
        );
        await trancheManager.waitForDeployment();

        const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
        const issuanceController = await IssuanceControllerV3.deploy(
            govAddress,
            await bricsToken.getAddress(),
            await trancheManager.getAddress(),
            await configRegistry.getAddress(),
            await navOracle.getAddress(),
            await mockUSDC.getAddress(),
            await treasury.getAddress(),
            await redemptionClaim.getAddress(),
            await preTrancheBuffer.getAddress(),
            await claimRegistry.getAddress()
        );
        await issuanceController.waitForDeployment();

        return {
            gov, ops, govAddress, opsAddress,
            mockUSDC, configRegistry, memberRegistry, navOracle, claimRegistry,
            treasury, preTrancheBuffer, bricsToken, redemptionClaim,
            trancheManager, issuanceController
        };
    }

    it("should deploy contracts successfully", async function () {
        const fx = await loadFixture(deployFixture);

        // Basic checks
        expect(await fx.mockUSDC.decimals()).to.equal(6);
        expect(await getNavRayCompat(fx.navOracle)).to.equal(ethers.parseUnits("1", 27)); // 1e27 RAY

        expect(await fx.configRegistry.emergencyLevel()).to.equal(0);
    });

    it("should open and close NAV window", async function () {
        const fx = await loadFixture(deployFixture);

        // Setup roles
        await fx.bricsToken.connect(fx.gov).grantRole(await fx.bricsToken.MINTER_ROLE(), await fx.issuanceController.getAddress());
        await fx.bricsToken.connect(fx.gov).grantRole(await fx.bricsToken.BURNER_ROLE(), await fx.issuanceController.getAddress());
        await fx.redemptionClaim.connect(fx.gov).grantRole(await fx.redemptionClaim.ISSUER_ROLE(), await fx.issuanceController.getAddress());
        await fx.redemptionClaim.connect(fx.gov).grantRole(await fx.redemptionClaim.BURNER_ROLE(), fx.opsAddress);
        await fx.issuanceController.connect(fx.gov).grantRole(await fx.issuanceController.OPS_ROLE(), fx.opsAddress);
        await fx.issuanceController.connect(fx.gov).grantRole(await fx.issuanceController.BURNER_ROLE(), fx.opsAddress);

        // Setup initial state
        await fx.configRegistry.connect(fx.gov).setEmergencyLevel(0, "normal operations");

        // Test NAV window lifecycle
        const now = await time.latest();
        const closeTime = now + 3 * 24 * 3600; // 3 days from now
        
        // Open window
        await expect(fx.issuanceController.connect(fx.ops).openNavWindow(closeTime))
            .to.emit(fx.issuanceController, "NAVWindowOpened")
            .withArgs(1, anyValue, closeTime);

        const window = await fx.issuanceController.currentNavWindow();
        expect(window.id).to.equal(1);
        expect(window.state).to.equal(1); // OPEN = 1

        // Fast forward time and close window
        await time.increase(3 * 24 * 3600);
        
        await expect(fx.issuanceController.connect(fx.ops).closeNavWindow())
            .to.emit(fx.issuanceController, "NAVWindowClosed")
            .withArgs(1, closeTime, 0);

        const closedWindow = await fx.issuanceController.currentNavWindow();
        expect(closedWindow.state).to.equal(2); // CLOSED = 2
    });

    it("SMOKE: basic redemption claim functionality", async function () {
        const fx = await loadFixture(deployFixture);

        // Setup roles for redemption
        await fx.redemptionClaim.connect(fx.gov).grantRole(await fx.redemptionClaim.ISSUER_ROLE(), fx.opsAddress);
        
        // Set NAV to 1e27 (1.0)
        await fx.navOracle.setLatestNAVRay(ethers.parseUnits("1", 27));
        expect(await getNavRayCompat(fx.navOracle)).to.equal(ethers.parseUnits("1", 27));

        // Test basic redemption claim minting
        const redeemAmount = ethers.parseUnits("100", 18);
        const strikeTs = await time.latest();
        const claimId = await fx.redemptionClaim.connect(fx.ops).mintClaim(fx.opsAddress, strikeTs, redeemAmount);
        
        // Verify claim was created
        const claimInfo = await fx.redemptionClaim.claimInfo(claimId);
        expect(claimInfo.owner).to.equal(fx.opsAddress);
        expect(claimInfo.amount).to.equal(redeemAmount);
    });
});

function anyValue() {
    return true;
}
