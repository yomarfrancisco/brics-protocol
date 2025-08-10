import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Oracle Degradation (SPEC §5)", function () {
    let gov: Signer, user1: Signer, user2: Signer, ops: Signer, burner: Signer;
    let signer1: Signer, signer2: Signer, signer3: Signer, emergencySigner: Signer;
    let govAddress: string, user1Address: string, user2Address: string, opsAddress: string, burnerAddress: string;
    let signer1Address: string, signer2Address: string, signer3Address: string, emergencySignerAddress: string;
    
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
        [gov, user1, user2, ops, burner, signer1, signer2, signer3, emergencySigner] = await ethers.getSigners();
        [govAddress, user1Address, user2Address, opsAddress, burnerAddress, signer1Address, signer2Address, signer3Address, emergencySignerAddress] = await Promise.all([
            gov.getAddress(), user1.getAddress(), user2.getAddress(), ops.getAddress(), burner.getAddress(),
            signer1.getAddress(), signer2.getAddress(), signer3.getAddress(), emergencySigner.getAddress()
        ]);

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const NAVOracleV3 = await ethers.getContractFactory("NAVOracleV3");
        navOracle = await NAVOracleV3.deploy(govAddress, ethers.encodeBytes32String("test-model"));

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
        await issuanceController.connect(gov).grantRole(await issuanceController.OPS_ROLE(), opsAddress);
        await issuanceController.connect(gov).grantRole(await issuanceController.BURNER_ROLE(), burnerAddress);
        await memberRegistry.connect(gov).setRegistrar(await operationalAgreement.getAddress());
        await operationalAgreement.connect(gov).approveMember(user1Address);
        await operationalAgreement.connect(gov).approveMember(user2Address);

        // Setup oracle signers
        await navOracle.connect(gov).setSigner(signer1Address, true);
        await navOracle.connect(gov).setSigner(signer2Address, true);
        await navOracle.connect(gov).setSigner(signer3Address, true);
        await navOracle.connect(gov).setEmergencySigner(emergencySignerAddress, true);

        // Setup initial state
        const currentTime = Math.floor(Date.now() / 1000);
        await navOracle.connect(gov).devSeedNAV(ethers.parseEther("1.0") * 10n ** 9n, currentTime); // 1.0 NAV
        await mockUSDC.mint(await treasury.getAddress(), ethers.parseUnits("1000000", 6)); // 1M USDC
        await configRegistry.connect(gov).setEmergencyLevel(0, "normal operations"); // NORMAL
        
        // Verify oracle starts in normal mode
        expect(await navOracle.getDegradationLevel()).to.equal(0); // NORMAL
    });

    describe("EIP-712 Signature Verification", function () {
        it("should verify valid EIP-712 signatures", async function () {
            const navRay = ethers.parseEther("1.0") * 10n ** 9n; // 1e27
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = await navOracle.nonce() + 1n; // Get current nonce and increment
            const modelHash = await navOracle.modelHash();

            // Create EIP-712 signature
            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                NAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "modelHash", type: "bytes32" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp,
                nonce: nonce,
                modelHash: modelHash
            };

            const signature1 = await signer1.signTypedData(domain, types, value);
            const signature2 = await signer2.signTypedData(domain, types, value);
            const signature3 = await signer3.signTypedData(domain, types, value);

            await expect(navOracle.setNAV(navRay, timestamp, nonce, [signature1, signature2, signature3]))
                .to.emit(navOracle, "NAVUpdated")
                .withArgs(navRay, timestamp, nonce, modelHash);
        });

        it("should reject invalid signatures", async function () {
            const navRay = ethers.parseEther("1.0") * 10n ** 9n;
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = await navOracle.nonce() + 1n;
            const modelHash = await navOracle.modelHash();

            // Create signature with wrong data
            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                NAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "modelHash", type: "bytes32" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp,
                nonce: nonce,
                modelHash: modelHash
            };

            const signature1 = await signer1.signTypedData(domain, types, value);
            const signature2 = await signer2.signTypedData(domain, types, value);
            
            // Use wrong NAV value in contract call
            const wrongNavRay = ethers.parseEther("1.1") * 10n ** 9n;
            
            await expect(navOracle.setNAV(wrongNavRay, timestamp, nonce, [signature1, signature2]))
                .to.be.revertedWithCustomError(navOracle, "QuorumNotMet");
        });

        it("should reject expired timestamps", async function () {
            const navRay = ethers.parseEther("1.0") * 10n ** 9n;
            const timestamp = Math.floor(Date.now() / 1000) - 2 * 3600; // 2 hours ago
            const nonce = await navOracle.nonce() + 1n;
            const modelHash = await navOracle.modelHash();

            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                NAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "modelHash", type: "bytes32" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp,
                nonce: nonce,
                modelHash: modelHash
            };

            const signature1 = await signer1.signTypedData(domain, types, value);
            const signature2 = await signer2.signTypedData(domain, types, value);
            const signature3 = await signer3.signTypedData(domain, types, value);

            await expect(navOracle.setNAV(navRay, timestamp, nonce, [signature1, signature2, signature3]))
                .to.be.revertedWith("ExpiredTimestamp");
        });
    });

    describe("Degradation Levels", function () {
        it("should transition through degradation levels based on time", async function () {
            // Start with normal level
            expect(await navOracle.getDegradationLevel()).to.equal(0); // NORMAL

            // Advance time to STALE (2 hours)
            await ethers.provider.send("evm_increaseTime", [2 * 3600 + 60]); // 2h + 1min
            await ethers.provider.send("evm_mine", []);
            
            expect(await navOracle.getDegradationLevel()).to.equal(1); // STALE

            // Advance time to DEGRADED (6 hours)
            await ethers.provider.send("evm_increaseTime", [4 * 3600]); // Additional 4h
            await ethers.provider.send("evm_mine", []);
            
            expect(await navOracle.getDegradationLevel()).to.equal(2); // DEGRADED

            // Advance time to EMERGENCY_OVERRIDE (24 hours)
            await ethers.provider.send("evm_increaseTime", [18 * 3600]); // Additional 18h
            await ethers.provider.send("evm_mine", []);
            
            expect(await navOracle.getDegradationLevel()).to.equal(3); // EMERGENCY_OVERRIDE
        });

        it("should apply correct haircuts for each degradation level", async function () {
            // Set fresh NAV to start in normal mode
            const currentTime = Math.floor(Date.now() / 1000);
            await navOracle.connect(gov).devSeedNAV(ethers.parseEther("1.0") * 10n ** 9n, currentTime);
            
            // Normal level - no haircut
            expect(await navOracle.getCurrentHaircutBps()).to.equal(0);

            // Advance to STALE level
            await ethers.provider.send("evm_increaseTime", [2 * 3600 + 60]);
            await ethers.provider.send("evm_mine", []);
            expect(await navOracle.getCurrentHaircutBps()).to.equal(200); // 2%

            // Advance to DEGRADED level
            await ethers.provider.send("evm_increaseTime", [4 * 3600]);
            await ethers.provider.send("evm_mine", []);
            expect(await navOracle.getCurrentHaircutBps()).to.equal(500); // 5%

            // Advance to EMERGENCY_OVERRIDE level
            await ethers.provider.send("evm_increaseTime", [18 * 3600]);
            await ethers.provider.send("evm_mine", []);
            expect(await navOracle.getCurrentHaircutBps()).to.equal(1000); // 10%
        });
    });

    describe("Emergency Signer Override", function () {
        it("should allow emergency signer to set NAV in degradation", async function () {
            // Force degradation mode
            await navOracle.connect(gov).toggleDegradationMode(true);

            const navRay = ethers.parseEther("0.95") * 10n ** 9n; // 0.95 NAV
            const timestamp = Math.floor(Date.now() / 1000);

            // Create emergency signature
            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                EmergencyNAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp
            };

            const signature = await emergencySigner.signTypedData(domain, types, value);

            await expect(navOracle.emergencySetNAV(navRay, timestamp, signature))
                .to.emit(navOracle, "EmergencyNAVSet")
                .withArgs(navRay, timestamp, emergencySignerAddress);

            expect(await navOracle.getDegradationLevel()).to.equal(3); // EMERGENCY_OVERRIDE
        });

        it("should reject emergency NAV from non-emergency signer", async function () {
            await navOracle.connect(gov).toggleDegradationMode(true);

            const navRay = ethers.parseEther("0.95") * 10n ** 9n;
            const timestamp = Math.floor(Date.now() / 1000);

            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                EmergencyNAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp
            };

            const signature = await signer1.signTypedData(domain, types, value); // Regular signer

            await expect(navOracle.emergencySetNAV(navRay, timestamp, signature))
                .to.be.revertedWith("not emergency signer");
        });
    });

    describe("Issuance Controller Integration", function () {
        it("should halt issuance in DEGRADED mode", async function () {
            // Advance time to DEGRADED level
            await ethers.provider.send("evm_increaseTime", [6 * 3600 + 60]);
            await ethers.provider.send("evm_mine", []);

            const usdcAmount = ethers.parseUnits("1000", 6);
            const tailCorrPpm = 1000;
            const sovUtilBps = 5000;
            const sovereignCode = ethers.encodeBytes32String("ZA");

            // Should not be able to issue in DEGRADED mode
            expect(await issuanceController.canIssue(usdcAmount, tailCorrPpm, sovUtilBps, sovereignCode))
                .to.be.false;
        });

        it("should apply haircut in STALE mode", async function () {
            // Set up sovereign caps first
            const sovereignCode = ethers.encodeBytes32String("ZA");
            await issuanceController.connect(gov).setSovereignCap(sovereignCode, ethers.parseUnits("1000000", 6), ethers.parseUnits("2000000", 6));

            // Set fresh NAV to start in normal mode
            const currentTime = Math.floor(Date.now() / 1000);
            await navOracle.connect(gov).devSeedNAV(ethers.parseEther("1.0") * 10n ** 9n, currentTime);

            // Advance time to STALE level
            await ethers.provider.send("evm_increaseTime", [2 * 3600 + 60]);
            await ethers.provider.send("evm_mine", []);

            const usdcAmount = ethers.parseUnits("1000", 6);
            const tailCorrPpm = 1000;
            const sovUtilBps = 5000;

            // Should be able to issue in STALE mode (with haircut applied)
            expect(await issuanceController.canIssue(usdcAmount, tailCorrPpm, sovUtilBps, sovereignCode))
                .to.be.true;
        });

        it("should allow redemptions in degradation mode", async function () {
            // Set up sovereign caps first
            const sovereignCode = ethers.encodeBytes32String("ZA");
            await issuanceController.connect(gov).setSovereignCap(sovereignCode, ethers.parseUnits("1000000", 6), ethers.parseUnits("2000000", 6));

            // Set fresh NAV to start in normal mode
            const currentTime = Math.floor(Date.now() / 1000);
            await navOracle.connect(gov).devSeedNAV(ethers.parseEther("1.0") * 10n ** 9n, currentTime);

            // Mint some tokens first (before degradation)
            await mockUSDC.mint(user1Address, ethers.parseUnits("1000", 6));
            await mockUSDC.connect(user1).approve(await issuanceController.getAddress(), ethers.parseUnits("1000", 6));
            await issuanceController.connect(ops).mintFor(user1Address, ethers.parseUnits("1000", 6), 1000, 5000, sovereignCode);

            // Advance time to DEGRADED level
            await ethers.provider.send("evm_increaseTime", [6 * 3600 + 60]);
            await ethers.provider.send("evm_mine", []);

            // Should be able to redeem in degradation mode
            const redeemAmount = ethers.parseEther("100");
            await expect(issuanceController.connect(ops).requestRedeemOnBehalf(user1Address, redeemAmount))
                .to.emit(issuanceController, "NAVRequestCreated");
        });
    });

    describe("Recovery Procedures", function () {
        it("should recover to normal mode when fresh NAV is set", async function () {
            // Advance to DEGRADED level
            await ethers.provider.send("evm_increaseTime", [6 * 3600 + 60]);
            await ethers.provider.send("evm_mine", []);
            expect(await navOracle.getDegradationLevel()).to.equal(2); // DEGRADED

            // Set fresh NAV with valid signatures
            const navRay = ethers.parseEther("1.0") * 10n ** 9n;
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = await navOracle.nonce() + 1n;
            const modelHash = await navOracle.modelHash();

            const domain = {
                name: "BRICS NAV Oracle",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await navOracle.getAddress()
            };

            const types = {
                NAVUpdate: [
                    { name: "navRay", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "modelHash", type: "bytes32" }
                ]
            };

            const value = {
                navRay: navRay,
                timestamp: timestamp,
                nonce: nonce,
                modelHash: modelHash
            };

            const signature1 = await signer1.signTypedData(domain, types, value);
            const signature2 = await signer2.signTypedData(domain, types, value);
            const signature3 = await signer3.signTypedData(domain, types, value);

            await navOracle.setNAV(navRay, timestamp, nonce, [signature1, signature2, signature3]);

            // Should be back to normal
            expect(await navOracle.getDegradationLevel()).to.equal(0); // NORMAL
        });
    });
});
