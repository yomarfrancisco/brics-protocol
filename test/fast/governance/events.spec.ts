import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Governance Events", () => {
  let gov: Signer;
  let configRegistry: Contract;
  let treasury: Contract;
  let instantLane: Contract;

  beforeEach(async () => {
    [gov] = await ethers.getSigners();
    
    // Deploy contracts
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    configRegistry = await ConfigRegistry.deploy(await gov.getAddress());
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(await gov.getAddress(), usdc, 1000);
    
    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    const bricsToken = await MockBRICSToken.deploy();
    
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    const navOracle = await MockNAVOracle.deploy();
    
    const MockMemberRegistry = await ethers.getContractFactory("MockMemberRegistry");
    const memberRegistry = await MockMemberRegistry.deploy();
    
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

  describe("ConfigRegistry Events", () => {
    it("should emit ParamSet event for setMaxTailCorrPpm", async () => {
      const newValue = 500_000_000;
      await expect(configRegistry.connect(gov).setMaxTailCorrPpm(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x7461696c00000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event for setMaxSovUtilBps", async () => {
      const newValue = 1500;
      await expect(configRegistry.connect(gov).setMaxSovUtilBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x736f760000000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event for setRedeemCapBps", async () => {
      const newValue = 2000;
      await expect(configRegistry.connect(gov).setRedeemCapBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x6361700000000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit ParamSet event for setInstantBufferBps", async () => {
      const newValue = 400;
      await expect(configRegistry.connect(gov).setInstantBufferBps(newValue))
        .to.emit(configRegistry, "ParamSet")
        .withArgs("0x6972620000000000000000000000000000000000000000000000000000000000", newValue);
    });

    it("should emit EmergencyLevelSet event", async () => {
      const level = 1;
      const reason = "test emergency";
      await expect(configRegistry.connect(gov).setEmergencyLevel(level, reason))
        .to.emit(configRegistry, "EmergencyLevelSet")
        .withArgs(level, reason);
    });

    it("should emit EmergencyParamsSet event", async () => {
      const level = 0;
      const params = {
        ammMaxSlippageBps: 100,
        instantBufferBps: 400,
        maxIssuanceRateBps: 10000,
        maxDetachmentBps: 10300
      };
      await expect(configRegistry.connect(gov).setEmergencyParams(level, params))
        .to.emit(configRegistry, "EmergencyParamsSet")
        .withArgs(level, [100, 400, 10000, 10300]);
    });

    it("should emit SovereignAdded event", async () => {
      const code = ethers.keccak256(ethers.toUtf8Bytes("TEST"));
      const utilCapBps = 5000;
      const haircutBps = 200;
      const weightBps = 3000;
      const enabled = true;
      
      await expect(configRegistry.connect(gov).addSovereign(code, utilCapBps, haircutBps, weightBps, enabled))
        .to.emit(configRegistry, "SovereignAdded")
        .withArgs(code, utilCapBps, haircutBps, weightBps, enabled);
    });

    it("should emit SovereignUpdated event", async () => {
      // First add a sovereign
      const code = ethers.keccak256(ethers.toUtf8Bytes("TEST"));
      await configRegistry.connect(gov).addSovereign(code, 5000, 200, 3000, true);
      
      // Then update it
      const newUtilCapBps = 6000;
      const newHaircutBps = 300;
      const newWeightBps = 4000;
      const newEnabled = false;
      
      await expect(configRegistry.connect(gov).updateSovereign(code, newUtilCapBps, newHaircutBps, newWeightBps, newEnabled))
        .to.emit(configRegistry, "SovereignUpdated")
        .withArgs(code, newUtilCapBps, newHaircutBps, newWeightBps, newEnabled);
    });

    it("should emit SovereignEnabled event", async () => {
      // First add a sovereign
      const code = ethers.keccak256(ethers.toUtf8Bytes("TEST"));
      await configRegistry.connect(gov).addSovereign(code, 5000, 200, 3000, true);
      
      // Then disable it
      await expect(configRegistry.connect(gov).setSovereignEnabled(code, false))
        .to.emit(configRegistry, "SovereignEnabled")
        .withArgs(code, false);
    });
  });

  describe("Treasury Events", () => {
    it("should emit BufferTargetSet event", async () => {
      const newBps = 1500;
      await expect(treasury.connect(gov).setBufferTargetBps(newBps))
        .to.emit(treasury, "BufferTargetSet")
        .withArgs(newBps);
    });

    it("should emit Paid event", async () => {
      const [gov, recipient] = await ethers.getSigners();
      const amount = 1000;
      
      // Fund treasury first
      const treasuryUsdc = await ethers.getContractAt("MockUSDC", await treasury.token());
      await treasuryUsdc.mint(await gov.getAddress(), 10000);
      await treasuryUsdc.approve(treasury.getAddress(), 10000);
      await treasury.connect(gov).fund(10000);
      
      await expect(treasury.connect(gov).pay(await recipient.getAddress(), amount))
        .to.emit(treasury, "Paid")
        .withArgs(await treasury.token(), await recipient.getAddress(), amount);
    });

    it("should emit Funded event", async () => {
      const amount = 1000;
      const treasuryUsdc = await ethers.getContractAt("MockUSDC", await treasury.token());
      await treasuryUsdc.mint(await gov.getAddress(), amount);
      await treasuryUsdc.approve(treasury.getAddress(), amount);
      
      await expect(treasury.connect(gov).fund(amount))
        .to.emit(treasury, "Funded")
        .withArgs(await treasury.token(), amount);
    });
  });

  describe("InstantLane Events", () => {
    it("should emit Paused event", async () => {
      await expect(instantLane.connect(gov).pause())
        .to.emit(instantLane, "Paused")
        .withArgs(await gov.getAddress());
    });

    it("should emit Unpaused event", async () => {
      await instantLane.connect(gov).pause();
      
      await expect(instantLane.connect(gov).unpause())
        .to.emit(instantLane, "Unpaused")
        .withArgs(await gov.getAddress());
    });
  });
});
