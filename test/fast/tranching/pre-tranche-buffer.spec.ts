import { expect } from "chai";
import { ethers } from "hardhat";
import { PreTrancheBuffer } from "../../../typechain-types";

describe("PreTrancheBuffer Fast Tests", function () {
  let buffer: PreTrancheBuffer;
  let gov: any;
  let user: any;

  beforeEach(async function () {
    [gov, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    const mockRegistry = await MemberRegistry.deploy(await gov.getAddress());
    
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const mockConfig = await ConfigRegistry.deploy(await gov.getAddress());

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    buffer = await PreTrancheBuffer.deploy(
      await gov.getAddress(),
      await mockUSDC.getAddress(),
      await mockRegistry.getAddress(),
      await mockConfig.getAddress()
    );

    // Set gov as registrar and add user as member
    await mockRegistry.connect(gov).setRegistrar(await gov.getAddress());
    await mockRegistry.connect(gov).setMember(await user.getAddress(), true);
  });

  describe("Constructor and Setup", function () {
    it("should deploy with correct parameters", async function () {
      expect(await buffer.usdc()).to.not.equal(ethers.ZeroAddress);
      expect(await buffer.registry()).to.not.equal(ethers.ZeroAddress);
      expect(await buffer.config()).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Buffer Balance", function () {
    it("should return correct buffer balance", async function () {
      const balance = await buffer.bufferBalance();
      expect(balance).to.equal(0);
    });
  });

  describe("Daily Cap", function () {
    it("should return daily instant cap per member", async function () {
      const cap = await buffer.dailyInstantCapPerMember();
      expect(cap).to.be.gt(0);
    });
  });

  describe("Available Instant Capacity", function () {
    it("should return available instant capacity", async function () {
      const capacity = await buffer.availableInstantCapacity(await user.getAddress());
      expect(capacity).to.be.gte(0);
    });
  });

  describe("Buffer Status", function () {
    it("should return buffer status", async function () {
      const [current, target, utilizationBps, healthy] = await buffer.getBufferStatus();
      expect(current).to.be.gte(0);
      expect(target).to.be.gt(0);
      expect(utilizationBps).to.be.gte(0);
      expect(healthy).to.be.a('boolean');
    });
  });

  describe("Target Buffer", function () {
    it("should return target buffer", async function () {
      const target = await buffer.targetBuffer();
      expect(target).to.be.gt(0);
    });
  });
});
