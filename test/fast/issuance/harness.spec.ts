import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Issuance Harness Tests", () => {
  let config: Contract;
  let oracle: Contract;
  let harness: Contract;

  let owner: Signer;
  let ownerAddr: string;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();

    // Deploy ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    config = await ConfigRegistry.deploy(ownerAddr);

    // Deploy MockSovereignCapacityOracle
    const MockSovereignCapacityOracle = await ethers.getContractFactory("MockSovereignCapacityOracle");
    oracle = await MockSovereignCapacityOracle.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC capacity

    // Deploy IssuanceGuard library first
    const IssuanceGuard = await ethers.getContractFactory("IssuanceGuard");
    const issuanceGuard = await IssuanceGuard.deploy();

    // Deploy IssuanceHarness with library linking
    const IssuanceHarness = await ethers.getContractFactory("IssuanceHarness", {
      libraries: {
        IssuanceGuard: await issuanceGuard.getAddress()
      }
    });
    harness = await IssuanceHarness.deploy(
      await oracle.getAddress(),
      await config.getAddress()
    );
  });

  describe("Happy Path", () => {
    it("should allow issuance within cap", async () => {
      const totalOutstanding = ethers.parseUnits("500000", 6); // 500k USDC
      const requested = ethers.parseUnits("400000", 6); // 400k USDC
      
      await expect(
        harness.testIssuance(totalOutstanding, requested, 0)
      ).to.not.be.reverted;
    });

    it("should calculate max issuable correctly", async () => {
      const capacity = ethers.parseUnits("1000000", 6);
      const maxIssuable = await harness.getMaxIssuable(capacity);
      
      // Should be 95% of capacity (default 500 bps buffer)
      const expected = capacity * 9500n / 10000n;
      expect(maxIssuable).to.equal(expected);
    });
  });

  describe("Cap Exceed Revert", () => {
    it("should revert when issuance exceeds cap", async () => {
      const totalOutstanding = ethers.parseUnits("900000", 6); // 900k USDC
      const requested = ethers.parseUnits("100000", 6); // 100k USDC
      
      // Total would be 1M, but maxIssuable is 950k (95% of 1M)
      await expect(
        harness.testIssuance(totalOutstanding, requested, 0)
      ).to.be.reverted;
    });
  });
});
