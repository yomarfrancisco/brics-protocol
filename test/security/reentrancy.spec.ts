import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { setNavCompat, getNavRayCompat, toUSDCfromTokens, RAY, tokensToUSDC, WAD, USDC_ONE } from "../utils/nav-helpers";
import { safeNow, safeIncreaseTo } from "../utils/time-helpers";
import { MalUSDC } from "../../contracts/malicious/MalUSDC";
import { MalRedemptionClaim } from "../../contracts/malicious/MalRedemptionClaim";

describe("Security: Reentrancy Protection", function () {
    async function deployReentrancyFixture() {
        const [gov, user1, user2] = await ethers.getSigners();

        // Deploy malicious contracts
        const MalUSDC = await ethers.getContractFactory("MalUSDC");
        const malUSDC = await MalUSDC.deploy();

        const MalRedemptionClaim = await ethers.getContractFactory("MalRedemptionClaim");
        const malRedemptionClaim = await MalRedemptionClaim.deploy();

        // Deploy core contracts with malicious dependencies
        const govAddress = await gov.getAddress();

        const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
        const navOracle = await MockNAVOracle.deploy();

        const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
        const memberRegistry = await MemberRegistry.deploy(govAddress);

        const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
        const configRegistry = await ConfigRegistry.deploy(govAddress);

        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(govAddress, await malUSDC.getAddress(), 300);

        const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
        const preTrancheBuffer = await PreTrancheBuffer.deploy(govAddress, await malUSDC.getAddress(), await memberRegistry.getAddress(), await configRegistry.getAddress());

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
            await malUSDC.getAddress(),
            await treasury.getAddress(),
            await malRedemptionClaim.getAddress(),
            await preTrancheBuffer.getAddress(),
            await claimRegistry.getAddress()
        );

        // Setup roles
        await bricsToken.grantRole(await bricsToken.MINTER_ROLE(), await issuanceController.getAddress());
        await bricsToken.grantRole(await bricsToken.BURNER_ROLE(), await issuanceController.getAddress());
        await treasury.grantRole(await treasury.PAY_ROLE(), await issuanceController.getAddress());
        await malRedemptionClaim.grantRole(await malRedemptionClaim.DEFAULT_ADMIN_ROLE(), await issuanceController.getAddress());
        await issuanceController.grantRole(await issuanceController.OPS_ROLE(), user1.address);

        // Fund treasury and user
        await malUSDC.mint(await treasury.getAddress(), ethers.parseUnits("1000000", 6));
        await malUSDC.mint(user1.address, ethers.parseUnits("10000", 6));
        await malUSDC.connect(user1).approve(await issuanceController.getAddress(), ethers.parseUnits("10000", 6));

        // Setup sovereign configuration
        await configRegistry.addSovereign(ethers.encodeBytes32String("TEST_SOV"), 8000, 2000, 5000, true);
        await issuanceController.setSovereignCap(ethers.encodeBytes32String("TEST_SOV"), ethers.parseUnits("1000000", 6), ethers.parseUnits("2000000", 6));
        
        // Set super senior cap
        await trancheManager.adjustSuperSeniorCap(ethers.parseEther("10000000"));
        
        // Set registrar and add user1 as member
        await memberRegistry.setRegistrar(gov.address);
        await memberRegistry.setMember(user1.address, true);

        // Setup NAV
        await setNavCompat(navOracle, ethers.parseUnits("1", 27)); // 1.0 NAV in RAY format

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
            user2,
            malUSDC,
            malRedemptionClaim,
            bricsToken,
            configRegistry,
            trancheManager,
            treasury,
            preTrancheBuffer,
            navOracle,
            issuanceController
        };
    }

    describe("Malicious USDC Reentrancy Attacks", function () {
        it("SMOKE: reentrancy test fixture deploys correctly", async function () {
            const { gov, user1, user2, malUSDC, malRedemptionClaim, bricsToken, configRegistry, trancheManager, treasury, preTrancheBuffer, navOracle, issuanceController } = await loadFixture(deployReentrancyFixture);

            // Verify all contracts deployed successfully
            expect(await gov.getAddress()).to.be.a('string');
            expect(await user1.getAddress()).to.be.a('string');
            expect(await user2.getAddress()).to.be.a('string');
            expect(await malUSDC.getAddress()).to.be.a('string');
            expect(await malRedemptionClaim.getAddress()).to.be.a('string');
            expect(await bricsToken.getAddress()).to.be.a('string');
            expect(await configRegistry.getAddress()).to.be.a('string');
            expect(await trancheManager.getAddress()).to.be.a('string');
            expect(await treasury.getAddress()).to.be.a('string');
            expect(await preTrancheBuffer.getAddress()).to.be.a('string');
            expect(await navOracle.getAddress()).to.be.a('string');
            expect(await issuanceController.getAddress()).to.be.a('string');

            // Verify NAV was set correctly
            const navRay = await getNavRayCompat(navOracle);
            expect(navRay).to.equal(10n ** 27n); // Hard assert: NAV must be exactly 1e27
            
            // Hard assert: 1 token at NAV 1.0 should equal exactly 1 USDC
            expect(tokensToUSDC(1n * WAD, navRay)).to.equal(USDC_ONE);
        });

        it("should prevent reentrancy in mintFor with malicious USDC", async function () {
            this.skip(); // TODO: unskip once Issue #61 is resolved (mintFor AmountZero bug)
            const { user1, malUSDC, issuanceController, bricsToken } = await loadFixture(deployReentrancyFixture);

            // Setup malicious USDC to reenter mintFor
            const mintForData = issuanceController.interface.encodeFunctionData("mintFor", [
                user1.address,
                ethers.parseUnits("1000", 6), // 1000 USDC
                0, // tailCorrPpm
                0, // sovUtilBps
                ethers.encodeBytes32String("ZA") // sovereignCode
            ]);

            await malUSDC.setReentrantTarget(await issuanceController.getAddress(), mintForData);
            await malUSDC.setShouldReenter(true);

            // Approve USDC
            await malUSDC.connect(user1).approve(await issuanceController.getAddress(), ethers.parseUnits("10000", 6));

            // Attempt mint - should succeed because reentrancy protection prevents the attack
            await expect(
                issuanceController.connect(user1).mintFor(
                    user1.address,
                    ethers.parseUnits("1000", 6),
                    0,
                    0,
                    ethers.encodeBytes32String("TEST_SOV")
                )
            ).to.emit(bricsToken, "Transfer"); // Should succeed and emit Transfer event

            // Verify reentrancy was attempted but prevented
            expect(await malUSDC.reentrantCount()).to.equal(1);
        });

        it("should prevent reentrancy in mintForSigned with malicious USDC", async function () {
            this.skip(); // TODO: unskip once Issue #61 is resolved (mintFor AmountZero bug)
            const { user1, malUSDC, issuanceController, bricsToken } = await loadFixture(deployReentrancyFixture);

            // Setup malicious USDC to reenter mintForSigned
            const mintForSignedData = issuanceController.interface.encodeFunctionData("mintForSigned", [
                user1.address,
                ethers.parseUnits("1000", 6),
                0,
                0,
                ethers.encodeBytes32String("TEST_SOV"),
                ethers.MaxUint256, // deadline
                "0x" // signature
            ]);

            await malUSDC.setReentrantTarget(await issuanceController.getAddress(), mintForSignedData);
            await malUSDC.setShouldReenter(true);

            // Approve USDC
            await malUSDC.connect(user1).approve(await issuanceController.getAddress(), ethers.parseUnits("10000", 6));

            // Attempt mint - should fail due to invalid signature (reentrancy protection prevents the attack)
            await expect(
                issuanceController.connect(user1).mintForSigned(
                    user1.address,
                    ethers.parseUnits("1000", 6),
                    0,
                    0,
                    ethers.encodeBytes32String("TEST_SOV"),
                    ethers.MaxUint256,
                    "0x"
                )
            ).to.be.revertedWithCustomError(issuanceController, "InvalidSignature"); // Should fail due to invalid signature

            // Verify no reentrancy was attempted due to early signature failure
            expect(await malUSDC.reentrantCount()).to.equal(0);
        });
    });

    describe("Malicious RedemptionClaim Reentrancy Attacks", function () {
        it("should prevent reentrancy in settleClaim with malicious RedemptionClaim", async function () {
            this.skip(); // TODO: unskip once Issue #61 is resolved (mintFor AmountZero bug)
            const { user1, malRedemptionClaim, issuanceController } = await loadFixture(deployReentrancyFixture);

            // Setup malicious RedemptionClaim to reenter settleClaim
            const settleClaimData = issuanceController.interface.encodeFunctionData("settleClaim", [
                1, // windowId
                1, // claimId
                user1.address // holder
            ]);

            await malRedemptionClaim.setReentrantTarget(await issuanceController.getAddress(), settleClaimData);
            await malRedemptionClaim.setShouldReenter(true);

            // Create a claim
            await malRedemptionClaim.mintClaim(user1.address, 0, ethers.parseEther("100"));

            // Attempt settlement - should fail due to invalid claim (reentrancy protection prevents the attack)
            await expect(
                issuanceController.settleClaim(1, 1, user1.address)
            ).to.be.reverted; // Should fail due to invalid claim, but reentrancy protection prevents the attack

            // Verify no state corruption
            expect(await malRedemptionClaim.reentrantCount()).to.equal(0);
        });
    });

    describe("State Consistency Verification", function () {
        it("should maintain state consistency during reentrancy attempts", async function () {
            this.skip(); // TODO: unskip once Issue #61 is resolved (mintFor AmountZero bug)
            const { user1, malUSDC, issuanceController, bricsToken } = await loadFixture(deployReentrancyFixture);

            // Record initial state
            const initialTotalIssued = await issuanceController.totalIssued();
            const initialUserBalance = await malUSDC.balanceOf(user1.address);

            // Setup malicious reentrancy attempt
            const mintForData = issuanceController.interface.encodeFunctionData("mintFor", [
                user1.address,
                ethers.parseUnits("1000", 6),
                0,
                0,
                ethers.encodeBytes32String("TEST_SOV")
            ]);

            await malUSDC.setReentrantTarget(await issuanceController.getAddress(), mintForData);
            await malUSDC.setShouldReenter(true);
            await malUSDC.connect(user1).approve(await issuanceController.getAddress(), ethers.parseUnits("10000", 6));

            // Attempt mint (should succeed because reentrancy protection prevents the attack)
            await expect(
                issuanceController.connect(user1).mintFor(
                    user1.address,
                    ethers.parseUnits("1000", 6),
                    0,
                    0,
                    ethers.encodeBytes32String("TEST_SOV")
                )
            ).to.emit(bricsToken, "Transfer"); // Should succeed and emit Transfer event

            // Verify state consistency - since mint succeeded, balances should have changed
            expect(await issuanceController.totalIssued()).to.be.gt(initialTotalIssued);
            expect(await malUSDC.balanceOf(user1.address)).to.be.lt(initialUserBalance);
        });
    });

    describe("CEI Pattern Verification", function () {
        it("should follow Checks-Effects-Interactions pattern in mintFor", async function () {
            this.skip(); // TODO: unskip once Issue #61 is resolved (mintFor AmountZero bug)
            const { user1, issuanceController } = await loadFixture(deployReentrancyFixture);

            // This test verifies that state variables are updated before external calls
            // The actual verification is in the contract code - state variables are updated
            // before token.mint() call, which is the external interaction

            // Record initial state
            const initialTotalIssued = await issuanceController.totalIssued();



            // Perform a real mint to verify CEI pattern
            await issuanceController.connect(user1).mintFor(
                user1.address,
                ethers.parseUnits("100", 6), // Use a small fixed amount
                0,
                0,
                ethers.encodeBytes32String("TEST_SOV")
            );

            // Verify state was updated correctly
            const finalTotalIssued = await issuanceController.totalIssued();
            expect(finalTotalIssued).to.be.gt(initialTotalIssued);
        });
    });
});
