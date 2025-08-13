import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

describe("Issuance Cap Tests", () => {
  let config: Contract;
  let oracle: Contract;
  let issuanceGuard: Contract;
  let testContract: Contract;

  let owner: Signer;
  let user: Signer;
  let ownerAddr: string;
  let userAddr: string;

  let snapshot: any;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();
    userAddr = await user.getAddress();

    // Deploy ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    config = await ConfigRegistry.deploy(ownerAddr);

    // Deploy MockSovereignCapacityOracle
    const MockSovereignCapacityOracle = await ethers.getContractFactory("MockSovereignCapacityOracle");
    oracle = await MockSovereignCapacityOracle.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC capacity

    // Deploy IssuanceGuard library
    const IssuanceGuard = await ethers.getContractFactory("IssuanceGuard");
    issuanceGuard = await IssuanceGuard.deploy();

    // Deploy test contract that uses IssuanceGuard
    const TestIssuanceContract = await ethers.getContractFactory("TestIssuanceContract", {
      libraries: {
        IssuanceGuard: await issuanceGuard.getAddress()
      }
    });
    testContract = await TestIssuanceContract.deploy(
      await oracle.getAddress(),
      await config.getAddress()
    );

    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ConfigRegistry Issuance Cap", () => {
    it("should calculate max issuable correctly", async () => {
      const capacity = ethers.parseUnits("1000000", 6); // 1M USDC
      const maxIssuable = await config.getMaxIssuable(capacity);
      
      // Default buffer is 500 bps (5%), so maxIssuable should be 95% of capacity
      const expected = capacity * 9500n / 10000n;
      expect(maxIssuable).to.equal(expected);
    });

    it("should update max issuable when buffer changes", async () => {
      const capacity = ethers.parseUnits("1000000", 6); // 1M USDC
      
      // Set buffer to 1000 bps (10%)
      await config.setIssuanceCapBufferBps(1000);
      const maxIssuable = await config.getMaxIssuable(capacity);
      
      // Should be 90% of capacity
      const expected = capacity * 9000n / 10000n;
      expect(maxIssuable).to.equal(expected);
    });

    it("should revert when buffer exceeds 100%", async () => {
      await expect(config.setIssuanceCapBufferBps(10001))
        .to.be.revertedWithCustomError(config, "BadParam");
    });
  });

  describe("IssuanceGuard Library", () => {
    it("should allow issuance within cap", async () => {
      const totalOutstanding = ethers.parseUnits("500000", 6); // 500k USDC
      const requested = ethers.parseUnits("400000", 6); // 400k USDC
      
      // Should not revert
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
    });

    it("should revert when issuance exceeds cap", async () => {
      const totalOutstanding = ethers.parseUnits("900000", 6); // 900k USDC
      const requested = ethers.parseUnits("100000", 6); // 100k USDC
      
      // Total would be 1M, but maxIssuable is 950k (95% of 1M)
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.be.reverted;
    });

    it("should check staleness when maxAge > 0", async () => {
      const totalOutstanding = ethers.parseUnits("500000", 6);
      const requested = ethers.parseUnits("100000", 6);
      
      // Set oracle timestamp to 1 hour ago
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      await oracle.setCapacityWithTimestamp(
        ethers.parseUnits("1000000", 6),
        oneHourAgo
      );
      
      // Should revert with stale data (maxAge = 30 minutes)
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 1800)
      ).to.be.reverted;
    });

    it("should not check staleness when maxAge = 0", async () => {
      const totalOutstanding = ethers.parseUnits("500000", 6);
      const requested = ethers.parseUnits("100000", 6);
      
      // Set oracle timestamp to 1 hour ago
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      await oracle.setCapacityWithTimestamp(
        ethers.parseUnits("1000000", 6),
        oneHourAgo
      );
      
      // Should not revert (no staleness check)
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
    });

    it("should get max issuable amount", async () => {
      const capacity = ethers.parseUnits("1000000", 6);
      const maxIssuable = await config.getMaxIssuable(capacity);
      
      // Should be 95% of capacity
      const expected = capacity * 9500n / 10000n;
      expect(maxIssuable).to.equal(expected);
    });
  });

  describe("Test Contract Integration", () => {
    it("should allow issuance within cap", async () => {
      const totalOutstanding = ethers.parseUnits("500000", 6);
      const requested = ethers.parseUnits("400000", 6);
      
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
    });

    it("should revert when issuance exceeds cap", async () => {
      const totalOutstanding = ethers.parseUnits("900000", 6);
      const requested = ethers.parseUnits("100000", 6);
      
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.be.reverted;
    });

    it("should handle capacity changes", async () => {
      // Increase capacity
      await oracle.setCapacity(ethers.parseUnits("2000000", 6)); // 2M USDC
      
      const totalOutstanding = ethers.parseUnits("1500000", 6);
      const requested = ethers.parseUnits("300000", 6);
      
      // Should now be allowed (total 1.8M < 1.9M maxIssuable)
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
    });
  });

  describe("Deterministic Fixture Case", () => {
    it("should work with replay provider off", async () => {
      // Use deterministic values for replay testing
      const capacity = ethers.parseUnits("1000000", 6);
      const totalOutstanding = ethers.parseUnits("500000", 6);
      const requested = ethers.parseUnits("400000", 6);
      
      // Set deterministic timestamp
      await oracle.setCapacityWithTimestamp(capacity, 1600000000);
      
      // Should work consistently
      await expect(
        testContract.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
      
      // Verify maxIssuable calculation
      const maxIssuable = await config.getMaxIssuable(capacity);
      expect(maxIssuable).to.equal(capacity * 9500n / 10000n);
    });
  });
});
