import { expect } from "chai";
import { ethers } from "hardhat";

describe("NAV Redemption Lane - Simple Test", function () {
    it("should deploy contracts successfully", async function () {
        const [gov] = await ethers.getSigners();
        const govAddress = await gov.getAddress();

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        const configRegistry = await ConfigRegistry.deploy(govAddress);

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        const memberRegistry = await MemberRegistry.deploy(govAddress);

        const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
        const navOracle = await MockNAVOracle.deploy();

        const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
        const claimRegistry = await ClaimRegistry.deploy(govAddress);

        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(govAddress, await mockUSDC.getAddress(), 300);

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        const preTrancheBuffer = await PreTrancheBuffer.deploy(
            govAddress,
            await mockUSDC.getAddress(),
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );

        const BRICSToken = await ethers.getContractFactory("BRICSToken");
        const bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());

        const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
        const redemptionClaim = await RedemptionClaim.deploy(
            govAddress,
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );

        const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
        const trancheManager = await TrancheManagerV2.deploy(
            govAddress,
            await navOracle.getAddress(),
            await configRegistry.getAddress()
        );

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

        // Basic checks
        expect(await mockUSDC.decimals()).to.equal(6);
        expect(await navOracle.navRay()).to.equal(ethers.parseEther("1.0") * 10n ** 9n); // 1.0 NAV in ray format (1e27)
        expect(await configRegistry.emergencyLevel()).to.equal(0);
        
    });

    it("should open and close NAV window", async function () {
        const [gov, ops] = await ethers.getSigners();
        const govAddress = await gov.getAddress();
        const opsAddress = await ops.getAddress();

        // Deploy contracts (simplified)
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        const configRegistry = await ConfigRegistry.deploy(govAddress);

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        const memberRegistry = await MemberRegistry.deploy(govAddress);

        const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
        const navOracle = await MockNAVOracle.deploy();

        const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
        const claimRegistry = await ClaimRegistry.deploy(govAddress);

        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(govAddress, await mockUSDC.getAddress(), 300);

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        const preTrancheBuffer = await PreTrancheBuffer.deploy(
            govAddress,
            await mockUSDC.getAddress(),
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );

        const BRICSToken = await ethers.getContractFactory("BRICSToken");
        const bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());

        const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
        const redemptionClaim = await RedemptionClaim.deploy(
            govAddress,
            await memberRegistry.getAddress(),
            await configRegistry.getAddress()
        );

        const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
        const trancheManager = await TrancheManagerV2.deploy(
            govAddress,
            await navOracle.getAddress(),
            await configRegistry.getAddress()
        );

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

        // Setup roles
        await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
        await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.ISSUER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.BURNER_ROLE(), opsAddress);
        await issuanceController.connect(gov).grantRole(await issuanceController.OPS_ROLE(), opsAddress);
        await issuanceController.connect(gov).grantRole(await issuanceController.BURNER_ROLE(), opsAddress);

        // Setup initial state
        await configRegistry.connect(gov).setEmergencyLevel(0, "normal operations");

        // Test NAV window lifecycle
        const closeTime = Math.floor(Date.now() / 1000) + 3 * 24 * 3600; // 3 days from now
        
        // Open window
        await expect(issuanceController.connect(ops).openNavWindow(closeTime))
            .to.emit(issuanceController, "NAVWindowOpened")
            .withArgs(1, anyValue, closeTime);

        const window = await issuanceController.currentNavWindow();
        expect(window.id).to.equal(1);
        expect(window.state).to.equal(1); // OPEN = 1

        // Fast forward time and close window
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600]);
        await ethers.provider.send("evm_mine", []);
        
        await expect(issuanceController.connect(ops).closeNavWindow())
            .to.emit(issuanceController, "NAVWindowClosed")
            .withArgs(1, closeTime, 0);

        const closedWindow = await issuanceController.currentNavWindow();
        expect(closedWindow.state).to.equal(2); // CLOSED = 2

    });
});

function anyValue() {
    return true;
}
