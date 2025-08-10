import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { chainNow, openWindow, fastForwardTo } from "./helpers";

describe("NAV Redemption Lane (SPEC §4)", function () {
    let gov: Signer, user1: Signer, user2: Signer, ops: Signer, burner: Signer;
    let govAddress: string, user1Address: string, user2Address: string, opsAddress: string, burnerAddress: string;
    
    let configRegistry: Contract;
    let memberRegistry: Contract;
    let operationalAgreement: Contract;
    let treasury: Contract;
    let preTrancheBuffer: Contract;
    let bricsToken: Contract;
    let redemptionClaim: Contract;
    let trancheManager: Contract;
    let navOracle: Contract;
    let claimRegistry: Contract;
    let issuanceController: Contract;
    let mockUSDC: Contract;

    beforeEach(async function () {
        [gov, user1, user2, ops, burner] = await ethers.getSigners();
        [govAddress, user1Address, user2Address, opsAddress, burnerAddress] = await Promise.all([
            gov.getAddress(), user1.getAddress(), user2.getAddress(), ops.getAddress(), burner.getAddress()
        ]);

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const MockOracle = await ethers.getContractFactory("MockNAVOracle");
        navOracle = await MockOracle.deploy();

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        configRegistry = await ConfigRegistry.deploy(govAddress);

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        memberRegistry = await MemberRegistry.deploy(govAddress);

        const OperationalAgreement = await ethers.getContractFactory("OperationalAgreement");
        operationalAgreement = await OperationalAgreement.deploy(govAddress, govAddress, await memberRegistry.getAddress());

        const Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy(govAddress, await mockUSDC.getAddress(), 300);

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        preTrancheBuffer = await PreTrancheBuffer.deploy(
            govAddress, 
            await mockUSDC.getAddress(), 
            await memberRegistry.getAddress(), 
            await configRegistry.getAddress()
        );

        const BRICSToken = await ethers.getContractFactory("BRICSToken");
        bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());

        const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
        redemptionClaim = await RedemptionClaim.deploy(
            govAddress, 
            await memberRegistry.getAddress(), 
            await configRegistry.getAddress()
        );

        const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
        trancheManager = await TrancheManagerV2.deploy(
            govAddress, 
            await navOracle.getAddress(), 
            await configRegistry.getAddress()
        );

        const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
        claimRegistry = await ClaimRegistry.deploy(govAddress);

        const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
        issuanceController = await IssuanceControllerV3.deploy(
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

        // Setup roles and permissions
        await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
        await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.ISSUER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.BURNER_ROLE(), burnerAddress);
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.BURNER_ROLE(), await issuanceController.getAddress());
        await issuanceController.connect(gov).grantRole(await issuanceController.OPS_ROLE(), opsAddress);
        await issuanceController.connect(gov).grantRole(await issuanceController.BURNER_ROLE(), burnerAddress);
        await memberRegistry.connect(gov).setRegistrar(await operationalAgreement.getAddress());
        await operationalAgreement.connect(gov).approveMember(user1Address);
        await operationalAgreement.connect(gov).approveMember(user2Address);
        
        // Grant PAY_ROLE to issuance controller for treasury settlement
        await treasury.connect(gov).grantRole(await treasury.PAY_ROLE(), await issuanceController.getAddress());

        // Setup initial state
        await navOracle.setNAV(ethers.parseEther("1.0")); // 1.0 NAV
        await mockUSDC.mint(await treasury.getAddress(), ethers.parseUnits("1000000", 6)); // 1M USDC
        await configRegistry.connect(gov).setEmergencyLevel(0, "normal operations"); // NORMAL
    });

    describe("NAV Window Lifecycle", function () {
        it("should open NAV window with valid close time", async function () {
            const closeTs = await openWindow(issuanceController, 2);
            
            const window = await issuanceController.currentNavWindow();
            expect(window.id).to.equal(1);
            expect(window.state).to.equal(1); // OPEN = 1
        });

        it("should not open window if one is already open", async function () {
            await openWindow(issuanceController, 2);
            
            const now = await chainNow();
            const closeTs = now + 3 * 24 * 3600;
            
            await expect(issuanceController.connect(ops).openNavWindow(closeTs))
                .to.be.revertedWithCustomError(issuanceController, "WindowAlreadyOpen");
        });

        it("should not open window with invalid close time", async function () {
            const now = await chainNow();
            const closeTs = now + 3600; // 1 hour from now (less than 2 days minimum)
            
            await expect(issuanceController.connect(ops).openNavWindow(closeTs))
                .to.be.revertedWithCustomError(issuanceController, "InvalidCloseTime");
        });

        it("should close NAV window after close time", async function () {
            const closeTs = await openWindow(issuanceController, 2);
            
            // Fast forward time past close time
            await fastForwardTo(closeTs + 1);
            
            await expect(issuanceController.connect(ops).closeNavWindow())
                .to.emit(issuanceController, "NAVWindowClosed")
                .withArgs(1, closeTs, 0);

            const window = await issuanceController.currentNavWindow();
            expect(window.state).to.equal(2); // CLOSED = 2
        });

        it("should not close window before close time", async function () {
            await openWindow(issuanceController, 2);
            
            await expect(issuanceController.connect(ops).closeNavWindow())
                .to.be.revertedWithCustomError(issuanceController, "InvalidCloseTime");
        });
    });

    describe("NAV Request Queueing", function () {

        it("should queue redemption request when instant capacity insufficient", async function () {
            // Open a new window for this test
            await openWindow(issuanceController, 2);
            
            const amount = ethers.parseEther("1000");
            
            await expect(issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, amount))
                .to.emit(issuanceController, "NAVRequestCreated")
                .withArgs(1, user1Address, amount);

            expect(await issuanceController.pendingOf(user1Address)).to.equal(amount);
        });

        it("should process instant redemption when capacity available", async function () {
            // Ensure user is a member (already done in beforeEach)
            
            // Fund gov signer and pre-tranche buffer
            await mockUSDC.mint(govAddress, ethers.parseUnits("1000000", 6));
            await mockUSDC.connect(gov).approve(await preTrancheBuffer.getAddress(), ethers.parseUnits("500000", 6));
            await preTrancheBuffer.connect(gov).fundBuffer(ethers.parseUnits("500000", 6));
            
            // Ensure issuance controller has BUFFER_MANAGER role
            await preTrancheBuffer.connect(gov).grantRole(await preTrancheBuffer.BUFFER_MANAGER(), await issuanceController.getAddress());
            
            // Debug: Check if issuance controller has BUFFER_MANAGER role
            const hasRole = await preTrancheBuffer.hasRole(await preTrancheBuffer.BUFFER_MANAGER(), await issuanceController.getAddress());
            
            // Give user some BRICS tokens to redeem
            await bricsToken.connect(gov).mint(user1Address, ethers.parseEther("1000"));
            
            // Use an amount that fits within the instant capacity (50 USDC)
            // Convert USDC amount to BRICS tokens at NAV 1.0
            const usdcAmount = ethers.parseUnits("40", 6); // 40 USDC
            const amount = ethers.parseEther("40"); // 40 BRICS tokens (at NAV 1.0)
            
            // Debug: Check instant capacity
            const instantCapacity = await preTrancheBuffer.availableInstantCapacity(user1Address);
            const nav = await navOracle.navRay();
            
            await expect(issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, amount))
                .to.emit(issuanceController, "InstantRedeemProcessed")
                .withArgs(user1Address, amount, "PreTrancheBuffer");
        });

        it("should not queue request when window not open", async function () {
            // Open and close the window
            const closeTs = await openWindow(issuanceController, 2);
            await fastForwardTo(closeTs + 1);
            await issuanceController.connect(ops).closeNavWindow();
            
            const amount = ethers.parseEther("1000");
            
            await expect(issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, amount))
                .to.be.revertedWithCustomError(issuanceController, "WindowNotOpen");
        });
    });

    describe("NAV Claims Minting", function () {
        beforeEach(async function () {
            // Ensure no window is open from previous tests
            const currentWindow = await issuanceController.currentNavWindow();
            if (currentWindow.state === 1) { // OPEN
                await fastForwardBy(3 * 24 * 3600);
                await issuanceController.connect(ops).closeNavWindow();
            }
            
            const closeTs = await openWindow(issuanceController, 2);
            
            // Queue some requests
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            await issuanceController.connect(ops).requestRedeemOnBehalf(user2Address, ethers.parseEther("200"));
            
            // Close window
            await fastForwardTo(closeTs + 1);
            await issuanceController.connect(ops).closeNavWindow();
        });

        it("should mint claims for queued users", async function () {
            await expect(issuanceController.connect(ops).mintClaimsForWindow([user1Address, user2Address]))
                .to.emit(issuanceController, "NAVClaimsMinted")
                .withArgs(1, 2, ethers.parseEther("300"));

            expect(await issuanceController.pendingOf(user1Address)).to.equal(0);
            expect(await issuanceController.pendingOf(user2Address)).to.equal(0);
        });

        it("should not mint claims before window closed", async function () {
            // Reopen window
            await openWindow(issuanceController, 2);
            
            await expect(issuanceController.connect(ops).mintClaimsForWindow([user1Address]))
                .to.be.revertedWithCustomError(issuanceController, "WindowNotClosed");
        });
    });

    describe("NAV Strike", function () {
        beforeEach(async function () {
            // Ensure no window is open from previous tests
            const currentWindow = await issuanceController.currentNavWindow();
            if (currentWindow.state === 1) { // OPEN
                await fastForwardBy(3 * 24 * 3600);
                await issuanceController.connect(ops).closeNavWindow();
            }
            
            const closeTs = await openWindow(issuanceController, 2);
            
            // Queue and close window
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            await fastForwardTo(closeTs + 1);
            await issuanceController.connect(ops).closeNavWindow();
        });

        it("should strike NAV for closed window", async function () {
            await expect(issuanceController.connect(ops).strikeRedemption())
                .to.emit(issuanceController, "NAVStruck")
                .withArgs(1, anyValue, ethers.parseEther("1.0"));

            const window = await issuanceController.currentNavWindow();
            expect(window.state).to.equal(3); // STRUCK
            expect(window.navRayAtStrike).to.equal(ethers.parseEther("1.0"));
        });

        it("should not strike NAV before window closed", async function () {
            // Reopen window
            await openWindow(issuanceController, 2);
            
            await expect(issuanceController.connect(ops).strikeRedemption())
                .to.be.revertedWithCustomError(issuanceController, "StrikePrereqNotMet");
        });
    });

    describe("NAV Settlement", function () {
        beforeEach(async function () {
            // Ensure no window is open from previous tests
            const currentWindow = await issuanceController.currentNavWindow();
            if (currentWindow.state === 1) { // OPEN
                await fastForwardBy(3 * 24 * 3600);
                await issuanceController.connect(ops).closeNavWindow();
            }
            
            // Ensure treasury has enough USDC for settlement
            await mockUSDC.mint(await treasury.getAddress(), ethers.parseUnits("100000", 6)); // Additional 100k USDC
            
            // Grant PAY_ROLE to issuance controller for settlement
            await treasury.connect(gov).grantRole(await treasury.PAY_ROLE(), await issuanceController.getAddress());
            
            const closeTs = await openWindow(issuanceController, 2);
            
            // Queue, close, mint claims, and strike
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            await fastForwardTo(closeTs + 1);
            await issuanceController.connect(ops).closeNavWindow();
            await issuanceController.connect(ops).mintClaimsForWindow([user1Address]);
            await issuanceController.connect(ops).strikeRedemption();
        });

        it("should settle claim for holder", async function () {
            const claimId = 1; // First claim minted
            
            // Advance time to T+5 days after strike
            const window = await issuanceController.currentNavWindow();
            const settleTs = Number(window.strikeTs) + 5 * 24 * 60 * 60 + 1;
            await ethers.provider.send("evm_setNextBlockTimestamp", [settleTs]);
            await ethers.provider.send("evm_mine", []);
            
            await expect(issuanceController.connect(burner).settleClaim(1, claimId, user1Address))
                .to.emit(issuanceController, "NAVSettled")
                .withArgs(1, claimId, user1Address, anyValue, 0);
        });

        it("should handle partial fills and carryover", async function () {
            // Drain treasury almost completely to force partial fill
            await treasury.connect(gov).pay(govAddress, ethers.parseUnits("1099999", 6)); // Leave only 1 USDC
            
            const claimId = 1;
            
            // Advance time to T+5 days after strike
            const window = await issuanceController.currentNavWindow();
            const settleTs = Number(window.strikeTs) + 5 * 24 * 60 * 60 + 1;
            await ethers.provider.send("evm_setNextBlockTimestamp", [settleTs]);
            await ethers.provider.send("evm_mine", []);
            
            await expect(issuanceController.connect(burner).settleClaim(1, claimId, user1Address))
                .to.emit(issuanceController, "NAVCarryoverCreated")
                .withArgs(1, claimId, anyValue);
        });
    });

    describe("Emergency Level Integration", function () {
        it("should respect emergency level freeze rules", async function () {
            // Set to ORANGE level
            await configRegistry.connect(gov).setEmergencyLevel(2, "orange level");
            
            const closeTs = await openWindow(issuanceController, 2);
            
            // Queue request
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            
            // Close and mint claims
            await fastForwardTo(closeTs + 1);
            await issuanceController.connect(ops).closeNavWindow();
            await issuanceController.connect(ops).mintClaimsForWindow([user1Address]);
            
            // Strike with future strike time
            await issuanceController.connect(ops).strikeRedemption();
            
            // Try to transfer claim before freeze period (should fail)
            const claimId = 1;
            await expect(
                redemptionClaim.connect(user1).safeTransferFrom(user1Address, user2Address, claimId, 1, "0x")
            ).to.be.revertedWith("claim frozen pre-strike");
        });
    });

    describe("View Functions", function () {
        it("should return correct next cutoff time", async function () {
            const closeTs = await openWindow(issuanceController, 2);
            
            expect(await issuanceController.nextCutoffTime()).to.equal(closeTs);
        });

        it("should return correct pending amounts", async function () {
            await openWindow(issuanceController, 2);
            
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            
            expect(await issuanceController.pendingOf(user1Address)).to.equal(ethers.parseEther("100"));
        });

        it("should return user request history", async function () {
            await openWindow(issuanceController, 2);
            
            await issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, ethers.parseEther("100"));
            
            const requests = await issuanceController.getUserRequests(user1Address);
            expect(requests.length).to.equal(1);
            expect(requests[0].amountTokens).to.equal(ethers.parseEther("100"));
        });
    });
});

function anyValue() {
    return true;
}
