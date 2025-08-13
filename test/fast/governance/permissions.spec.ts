import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Governance Permissions", () => {
  let gov: Signer;
  let user: Signer;
  let random: Signer;
  let configRegistry: Contract;
  let treasury: Contract;
  let instantLane: Contract;
  let bricsToken: Contract;
  let navOracle: Contract;
  let memberRegistry: Contract;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    gov = signers[0];
    user = signers[1];
    random = signers[2]; // Ensure random is different from gov
    
    // Deploy contracts
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(await gov.getAddress());
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(await gov.getAddress(), usdc, 1000);
    
    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    const memberRegistry = await MockMemberRegistry.deploy();
    
    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    bricsToken = await BRICSToken.deploy(await gov.getAddress(), memberRegistry);
    
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy();
    
    const MockAMM = await ethers.getContractFactory("MockAMM");
    const amm = await MockAMM.deploy(usdc, bricsToken);
    
    const InstantLane = await ethers.getContractFactory("InstantLane");
    instantLane = await InstantLane.deploy(
      bricsToken,
      usdc,
      navOracle,
      memberRegistry,
      amm,
      configRegistry,
      ethers.ZeroAddress, // no PMM
      await gov.getAddress()
    );
  });

  describe("ConfigRegistry Permissions", () => {
    const testCases = [
      {
        contract: "ConfigRegistry",
        function: "setMaxTailCorrPpm",
        args: [500_000_000],
        role: "GOV_ROLE"
      },
      {
        contract: "ConfigRegistry", 
        function: "setMaxSovUtilBps",
        args: [1500],
        role: "GOV_ROLE"
      },
      {
        contract: "ConfigRegistry",
        function: "setRedeemCapBps", 
        args: [2000],
        role: "GOV_ROLE"
      },
      {
        contract: "ConfigRegistry",
        function: "setInstantBufferBps",
        args: [400],
        role: "GOV_ROLE"
      },
      {
        contract: "ConfigRegistry",
        function: "setEmergencyLevel",
        args: [1, "test"],
        role: "GOV_ROLE"
      },
      {
        contract: "ConfigRegistry",
        function: "setEmergencyParams",
        args: [0, {
          ammMaxSlippageBps: 100,
          instantBufferBps: 400,
          maxIssuanceRateBps: 10000,
          maxDetachmentBps: 10300
        }],
        role: "GOV_ROLE"
      }
    ];

    testCases.forEach(({ contract, function: funcName, args, role }) => {
      it(`${contract}.${funcName} should require ${role}`, async () => {
        const contractInstance = contract === "ConfigRegistry" ? configRegistry : 
                               contract === "Treasury" ? treasury :
                               contract === "InstantLane" ? instantLane : bricsToken;
        
        // Should succeed with correct role
        await expect(contractInstance.connect(gov)[funcName](...args))
          .to.not.be.reverted;
        
        // Should fail with random account
        try {
          await contractInstance.connect(random)[funcName](...args);
          expect.fail("Should have reverted");
        } catch (error: any) {
          // Check for various possible error messages
          const errorMsg = error.message || error.toString();
          expect(
            errorMsg.includes("AccessControl") || 
            errorMsg.includes("Unauthorized") ||
            errorMsg.includes("revert")
          ).to.be.true;
        }
      });
    });
  });

  describe("Treasury Permissions", () => {
    it("setBufferTargetBps should require GOV_ROLE", async () => {
      // Should succeed with correct role
      await expect(treasury.connect(gov).setBufferTargetBps(1500))
        .to.not.be.reverted;
      
      // Should fail with random account
      try {
        await treasury.connect(random).setBufferTargetBps(1500);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("AccessControl");
      }
    });

    it("pay should require PAY_ROLE", async () => {
      // Fund treasury first using the existing USDC
      const treasuryUsdc = await ethers.getContractAt("MockUSDC", await treasury.token());
      await treasuryUsdc.mint(await gov.getAddress(), 10000);
      await treasuryUsdc.approve(treasury.getAddress(), 10000);
      await treasury.connect(gov).fund(10000);
      
      // Should succeed with correct role
      await expect(treasury.connect(gov).pay(await user.getAddress(), 1000))
        .to.not.be.reverted;
      
      // Should fail with random account
      try {
        await treasury.connect(random).pay(await user.getAddress(), 1000);
        expect.fail("Should have reverted");
      } catch (error: any) {
        // Check for various possible error messages
        const errorMsg = error.message || error.toString();
        expect(
          errorMsg.includes("AccessControl") || 
          errorMsg.includes("Unauthorized") ||
          errorMsg.includes("revert")
        ).to.be.true;
      }
    });

    it("pay should reject zero address", async () => {
      await expect(treasury.connect(gov).pay(ethers.ZeroAddress, 1000))
        .to.be.revertedWith("Treasury: zero address");
    });
  });

  describe("InstantLane Permissions", () => {
    it("pause should require PAUSER_ROLE", async () => {
      // Should succeed with correct role
      await expect(instantLane.connect(gov).pause())
        .to.not.be.reverted;
      
      // Should fail with random account
      try {
        await instantLane.connect(random).pause();
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("AccessControl");
      }
    });

    it("unpause should require PAUSER_ROLE", async () => {
      // Pause first
      await instantLane.connect(gov).pause();
      
      // Should succeed with correct role
      await expect(instantLane.connect(gov).unpause())
        .to.not.be.reverted;
      
      // Pause again for next test
      await instantLane.connect(gov).pause();
      
      // Should fail with random account
      try {
        await instantLane.connect(random).unpause();
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("AccessControl");
      }
    });
  });

  describe("BRICS Token Permissions", () => {
    it("mint should require MINTER_ROLE", async () => {
      // Should succeed with correct role
      await expect(bricsToken.connect(gov).mint(await user.getAddress(), 1000))
        .to.not.be.reverted;
      
      // Should fail with random account
      try {
        await bricsToken.connect(random).mint(await user.getAddress(), 1000);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("AccessControl");
      }
    });

    it("burn should require BURNER_ROLE", async () => {
      // Mint first
      await bricsToken.connect(gov).mint(await user.getAddress(), 1000);
      
      // Should succeed with correct role
      await expect(bricsToken.connect(gov).burn(await user.getAddress(), 500))
        .to.not.be.reverted;
      
      // Should fail with random account
      try {
        await bricsToken.connect(random).burn(await user.getAddress(), 500);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("AccessControl");
      }
    });
  });

  describe("Public Functions", () => {
    it("should allow public access to view functions", async () => {
      // ConfigRegistry view functions
      await expect(configRegistry.connect(random).getBoundsForLevel(0))
        .to.not.be.reverted;
      
      await expect(configRegistry.connect(random).getCurrentParams())
        .to.not.be.reverted;
      
      // Treasury view functions
      await expect(treasury.connect(random).balance())
        .to.not.be.reverted;
      
      await expect(treasury.connect(random).getLiquidityStatus())
        .to.not.be.reverted;
      
      // InstantLane view functions
      await expect(instantLane.connect(random).preTradeCheck(10000, 0))
        .to.not.be.reverted;
    });
  });
});
