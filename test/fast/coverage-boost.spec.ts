import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury } from "../../typechain-types";
import { TrancheManagerV2 } from "../../typechain-types";

describe("Coverage Boost Tests", function () {
  let treasury: Treasury;
  let trancheManager: TrancheManagerV2;
  let owner: any;
  let mockUSDC: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    
    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address, await mockUSDC.getAddress(), 5000);
    
    // Deploy mock contracts for TrancheManagerV2 dependencies
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    const mockOracle = await MockNAVOracle.deploy();
    
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const mockConfig = await ConfigRegistry.deploy(owner.address);
    
    // Deploy TrancheManagerV2
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      owner.address, // gov
      await mockOracle.getAddress(), // oracle
      await mockConfig.getAddress()  // config
    );
  });

  describe("Treasury Coverage Boost", function () {
    it("should test shortfall calculation and balance function", async function () {
      // Set a large target so we can trigger shortfall
      await treasury.setBufferTargetBps(1_000_000_000); // 1B USDC target
      
      // Fund 300 USDC (much less than target)
      const fundAmount = ethers.parseUnits("300", 6); // 300 USDC
      await mockUSDC.mint(owner.address, fundAmount);
      await mockUSDC.approve(await treasury.getAddress(), fundAmount);
      await treasury.fund(fundAmount);
      
      // Test balance() function directly
      const balance = await treasury.balance();
      expect(balance).to.equal(fundAmount);
      
      // Test getLiquidityStatus() - should show shortfall
      const status = await treasury.getLiquidityStatus();
      
      // Returns: (preTranche, irbBalance, irbTarget, shortfallBps, healthy)
      expect(status[0]).to.equal(0); // preTranche
      expect(status[1]).to.equal(fundAmount); // irbBalance (300 USDC)
      expect(status[2]).to.equal(1_000_000_000); // irbTarget (1B USDC)
      expect(status[3]).to.be.gt(0); // shortfallBps (should be > 0)
      expect(status[4]).to.equal(false); // healthy (should be false)
      
      // Verify shortfall calculation is in expected range (6900-7100)
      expect(status[3]).to.be.gte(6900);
      expect(status[3]).to.be.lte(7100);
    });
  });

  describe("TrancheManagerV2 Coverage Boost", function () {
    it("should test governance toggles", async function () {
      // Test setIssuanceLocked toggle
      await expect(trancheManager.setIssuanceLocked(true))
        .to.not.be.reverted;
      
      await expect(trancheManager.setIssuanceLocked(false))
        .to.not.be.reverted;
      
      // Test adjustSuperSeniorCap (this should hit the statement)
      // We'll call it with a safe value that should work
      const currentCap = await trancheManager.superSeniorCap();
      await expect(trancheManager.adjustSuperSeniorCap(currentCap))
        .to.not.be.reverted;
    });
  });
});
