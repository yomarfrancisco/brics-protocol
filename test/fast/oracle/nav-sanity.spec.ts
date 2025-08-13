import { expect } from "chai";
import { ethers } from "hardhat";

describe("NAV/TWAP Sanity Guard", () => {
  let mockOracle: any;

  beforeEach(async () => {
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    mockOracle = await MockNAVOracle.deploy();
    await mockOracle.waitForDeployment();
  });

  it("should allow initial NAV setting", async () => {
    // Initial NAV setting should always work
    await expect(mockOracle.setNavRay(ethers.parseUnits("1", 27)))
      .to.not.be.reverted;
    
    expect(await mockOracle.latestNAVRay()).to.equal(ethers.parseUnits("1", 27));
  });

  it("should allow small NAV changes within bounds", async () => {
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    
    // Small change within 5% bounds should work
    const smallChange = ethers.parseUnits("1.02", 27); // 2% increase
    await expect(mockOracle.setNavRay(smallChange))
      .to.not.be.reverted;
    
    expect(await mockOracle.latestNAVRay()).to.equal(smallChange);
  });

  it("should revert large NAV jumps when emergency disabled", async () => {
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    
    // Large jump (10% increase) should revert
    const largeJump = ethers.parseUnits("1.10", 27); // 10% increase
    await expect(mockOracle.setNavRay(largeJump))
      .to.be.revertedWith("NAV_JUMP");
  });

  it("should allow large NAV jumps when emergency enabled", async () => {
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    
    // Enable emergency mode
    await mockOracle.setEmergency(true);
    
    // Large jump should now work
    const largeJump = ethers.parseUnits("1.10", 27); // 10% increase
    await expect(mockOracle.setNavRay(largeJump))
      .to.not.be.reverted;
    
    expect(await mockOracle.latestNAVRay()).to.equal(largeJump);
  });

  it("should respect custom maxJumpBps setting", async () => {
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    
    // Set custom max jump to 2%
    await mockOracle.setMaxJumpBps(200); // 2%
    
    // 3% change should now revert
    const threePercentChange = ethers.parseUnits("1.03", 27); // 3% increase
    await expect(mockOracle.setNavRay(threePercentChange))
      .to.be.revertedWith("NAV_JUMP");
    
    // 1% change should still work
    const onePercentChange = ethers.parseUnits("1.01", 27); // 1% increase
    await expect(mockOracle.setNavRay(onePercentChange))
      .to.not.be.reverted;
  });

  it("should handle both positive and negative jumps", async () => {
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    
    // Large negative jump should revert
    const largeNegativeJump = ethers.parseUnits("0.90", 27); // 10% decrease
    await expect(mockOracle.setNavRay(largeNegativeJump))
      .to.be.revertedWith("NAV_JUMP");
    
    // Small negative change should work
    const smallNegativeChange = ethers.parseUnits("0.98", 27); // 2% decrease
    await expect(mockOracle.setNavRay(smallNegativeChange))
      .to.not.be.reverted;
  });

  it("should work with setLatestNAVRay function", async () => {
    // Set initial NAV
    await mockOracle.setLatestNAVRay(ethers.parseUnits("1", 27));
    
    // Large jump should revert
    const largeJump = ethers.parseUnits("1.10", 27); // 10% increase
    await expect(mockOracle.setLatestNAVRay(largeJump))
      .to.be.revertedWith("NAV_JUMP");
    
    // Enable emergency and try again
    await mockOracle.setEmergency(true);
    await expect(mockOracle.setLatestNAVRay(largeJump))
      .to.not.be.reverted;
  });

  it("should track lastNavRay correctly", async () => {
    // Initial state
    expect(await mockOracle.lastNavRay()).to.equal(0);
    
    // Set initial NAV
    await mockOracle.setNavRay(ethers.parseUnits("1", 27));
    expect(await mockOracle.lastNavRay()).to.equal(ethers.parseUnits("1", 27));
    
    // Set another NAV
    await mockOracle.setNavRay(ethers.parseUnits("1.02", 27));
    expect(await mockOracle.lastNavRay()).to.equal(ethers.parseUnits("1.02", 27));
  });
});

