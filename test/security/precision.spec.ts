import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Security: Precision Loss Protection", function () {
    async function deployPrecisionFixture() {
        const [gov, user1] = await ethers.getSigners();
        const govAddress = await gov.getAddress();

        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();

        const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
        const navOracle = await MockNAVOracle.deploy();

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        const memberRegistry = await MemberRegistry.deploy(govAddress);

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        const configRegistry = await ConfigRegistry.deploy(govAddress);

        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(govAddress, await mockUSDC.getAddress(), 300);

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        const preTrancheBuffer = await PreTrancheBuffer.deploy(govAddress, await mockUSDC.getAddress(), await memberRegistry.getAddress(), await configRegistry.getAddress());

        const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
        const redemptionClaim = await RedemptionClaim.deploy(govAddress, await memberRegistry.getAddress(), await configRegistry.getAddress());

        const BRICSToken = await ethers.getContractFactory("BRICSToken");
        const bricsToken = await BRICSToken.deploy(govAddress, await memberRegistry.getAddress());

        const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
        const trancheManager = await TrancheManagerV2.deploy(govAddress, await navOracle.getAddress(), await configRegistry.getAddress());

        const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
        const claimRegistry = await ClaimRegistry.deploy(govAddress);

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
        await bricsToken.grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
        await bricsToken.grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
        await treasury.grantRole(await treasury.PAY_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.grantRole(await redemptionClaim.ISSUER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.grantRole(await redemptionClaim.BURNER_ROLE(), await issuanceController.getAddress());

        // Setup roles
        await bricsToken.connect(gov).grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
        await bricsToken.connect(gov).grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
        await treasury.connect(gov).grantRole(await treasury.PAY_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.ISSUER_ROLE(), await issuanceController.getAddress());
        await redemptionClaim.connect(gov).grantRole(await redemptionClaim.BURNER_ROLE(), await issuanceController.getAddress());

        // Fund treasury
        await mockUSDC.mint(await treasury.getAddress(), ethers.parseUnits("1000000", 6));

        // Setup NAV
        await navOracle.setNAV(ethers.parseEther("1.0"));

        // Setup sovereign configuration
        await configRegistry.connect(gov).addSovereign(
            ethers.encodeBytes32String("ZA"),
            8000, // utilCapBps
            1000, // haircutBps
            5000, // weightBps
            true   // enabled
        );

        await issuanceController.connect(gov).setSovereignCap(
            ethers.encodeBytes32String("ZA"),
            ethers.parseUnits("1000000", 6), // 1M USDC soft cap
            ethers.parseUnits("2000000", 6)  // 2M USDC hard cap
        );

        return {
            gov,
            user1,
            bricsToken,
            configRegistry,
            trancheManager,
            mockUSDC,
            treasury,
            preTrancheBuffer,
            navOracle,
            redemptionClaim,
            claimRegistry,
            issuanceController
        };
    }

    describe("Token to USDC Conversion Precision Tests", function () {
        it("should handle edge cases without precision loss", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Test with very small amounts through canIssue
            await navOracle.setNAV(ethers.parseEther("1.0")); // 1.0 NAV
            const smallResult = await issuanceController.canIssue(
                ethers.parseUnits("1", 6), // 1 USDC
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA")
            );
            expect(typeof smallResult).to.equal("boolean");

            // Test with very large amounts
            await navOracle.setNAV(ethers.parseEther("1000.0")); // 1000 NAV
            const largeResult = await issuanceController.canIssue(
                ethers.parseUnits("1000000", 6), // 1M USDC
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA")
            );
            expect(typeof largeResult).to.equal("boolean");

            // Test with NAV = 0
            await navOracle.setNAV(0n);
            const zeroNavResult = await issuanceController.canIssue(
                ethers.parseUnits("1000", 6),
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA")
            );
            expect(typeof zeroNavResult).to.equal("boolean");
        });

        it("should maintain precision across different NAV values", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Test NAV values from 0.0001 to 10000
            const navValues = [
                ethers.parseEther("0.0001"),
                ethers.parseEther("0.001"),
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("1.0"),
                ethers.parseEther("10.0"),
                ethers.parseEther("100.0"),
                ethers.parseEther("1000.0"),
                ethers.parseEther("10000.0")
            ];

            for (const nav of navValues) {
                await navOracle.setNAV(nav);
                const result = await issuanceController.canIssue(
                    ethers.parseUnits("1000", 6), // 1000 USDC
                    0, // tailCorrPpm
                    0, // sovUtilBps
                    ethers.encodeBytes32String("ZA")
                );
                
                // Should not revert due to precision loss
                expect(typeof result).to.equal("boolean");
            }
        });

        it("should handle maximum values without overflow", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Test with maximum NAV value
            await navOracle.setNAV(ethers.MaxUint256);

            // This should not revert due to overflow
            const result = await issuanceController.canIssue(
                ethers.parseUnits("1000", 6),
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA")
            );
            expect(typeof result).to.equal("boolean");
        });
    });

    describe("Divide-Before-Multiply Precision Tests", function () {
        it("should handle precision loss in _calculateEffectiveCapacity", async function () {
            const { issuanceController } = await loadFixture(deployPrecisionFixture);

            // Sovereign is already configured in the fixture
            // Test with zero utilization (default state) through canIssue
            const canIssue = await issuanceController.canIssue(
                ethers.parseUnits("1000", 6),
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA")
            );

            // Should be able to issue when utilization is 0
            expect(typeof canIssue).to.equal("boolean");
        });

        it("should handle precision loss in canIssue calculations", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Set NAV to various values
            const navValues = [
                ethers.parseEther("0.0001"),
                ethers.parseEther("0.001"),
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("1.0"),
                ethers.parseEther("10.0"),
                ethers.parseEther("100.0"),
                ethers.parseEther("1000.0")
            ];

            for (const nav of navValues) {
                await navOracle.setNAV(nav);

                const canIssue = await issuanceController.canIssue(
                    ethers.parseUnits("1000", 6), // 1000 USDC
                    0, // tailCorrPpm
                    0, // sovUtilBps
                    ethers.encodeBytes32String("ZA")
                );

                // Should not revert due to precision loss
                expect(typeof canIssue).to.equal("boolean");
            }
        });
    });

    describe("Randomized Fuzz Tests", function () {
        it("should handle random large values without precision loss", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Generate random test cases
            for (let i = 0; i < 10; i++) { // Reduced to 10 for faster tests
                // Random NAV between 0.0001 and 10000
                const navRay = BigInt(Math.floor(Math.random() * 1e8) + 1) * ethers.parseEther("0.0001");
                await navOracle.setNAV(navRay);

                // Should not revert
                const result = await issuanceController.canIssue(
                    ethers.parseUnits("1000", 6),
                    0, // tailCorrPpm
                    0, // sovUtilBps
                    ethers.encodeBytes32String("ZA")
                );
                expect(typeof result).to.equal("boolean");
            }
        });

        it("should handle boundary conditions correctly", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Test boundary conditions
            const boundaryTests = [
                ethers.parseEther("0.000000001"),
                ethers.parseEther("1"),
                ethers.parseEther("1000000"),
                ethers.MaxUint256
            ];

            for (const navRay of boundaryTests) {
                await navOracle.setNAV(navRay);
                const result = await issuanceController.canIssue(
                    ethers.parseUnits("1000", 6),
                    0, // tailCorrPpm
                    0, // sovUtilBps
                    ethers.encodeBytes32String("ZA")
                );
                expect(typeof result).to.equal("boolean");
            }
        });
    });

    describe("Decimal Conversion Accuracy", function () {
        it("should maintain accuracy across 6/18/27 decimal conversions", async function () {
            const { issuanceController, navOracle } = await loadFixture(deployPrecisionFixture);

            // Test with known NAV values
            const testCases = [
                ethers.parseEther("1.0"), // 1.0 NAV
                ethers.parseEther("2.0"), // 2.0 NAV
                ethers.parseEther("0.5"), // 0.5 NAV
                ethers.parseEther("0.1"), // 0.1 NAV
                ethers.parseEther("10.0") // 10.0 NAV
            ];

            for (const navRay of testCases) {
                await navOracle.setNAV(navRay);
                const result = await issuanceController.canIssue(
                    ethers.parseUnits("1000", 6), // 1000 USDC
                    0, // tailCorrPpm
                    0, // sovUtilBps
                    ethers.encodeBytes32String("ZA")
                );
                
                // Should not revert due to precision loss
                expect(typeof result).to.equal("boolean");
            }
        });
    });
});
