import { expect } from "chai";
import { ethers } from "hardhat";
import { MemberRegistry, TrancheManagerV2 } from "../../typechain-types";

describe("Zero Address Validation", function () {
  let memberRegistry: MemberRegistry;
  let trancheManager: TrancheManagerV2;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    // Deploy MemberRegistry
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    memberRegistry = await MemberRegistry.deploy(owner.address);
    
    // Deploy TrancheManagerV2
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(owner.address, addr1.address, addr1.address);
  });

  describe("MemberRegistry.setRegistrar", function () {
    it("should revert when setting zero address as registrar", async function () {
      await expect(
        memberRegistry.setRegistrar(ethers.ZeroAddress)
      ).to.be.revertedWith("registrar cannot be zero address");
    });

    it("should allow setting valid address as registrar", async function () {
      await expect(
        memberRegistry.setRegistrar(addr1.address)
      ).to.not.be.reverted;
      
      expect(await memberRegistry.registrar()).to.equal(addr1.address);
    });
  });

  describe("TrancheManagerV2 constructor", function () {
    it("should revert when oracle is zero address", async function () {
      const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
      await expect(
        TrancheManagerV2.deploy(owner.address, ethers.ZeroAddress, addr1.address)
      ).to.be.revertedWith("oracle cannot be zero address");
    });

    it("should revert when config is zero address", async function () {
      const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
      await expect(
        TrancheManagerV2.deploy(owner.address, addr1.address, ethers.ZeroAddress)
      ).to.be.revertedWith("config cannot be zero address");
    });

    it("should deploy successfully with valid addresses", async function () {
      const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
      const tm = await TrancheManagerV2.deploy(owner.address, addr1.address, addr1.address);
      
      expect(await tm.oracle()).to.equal(addr1.address);
      expect(await tm.config()).to.equal(addr1.address);
    });
  });
});
