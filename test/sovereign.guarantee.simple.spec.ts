import { expect } from "chai";
import { ethers } from "hardhat";

describe("Sovereign Guarantee Simple Test", function () {
  it("should deploy ClaimRegistry", async function () {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    const claimRegistry = await ClaimRegistry.deploy(deployerAddress);
    
    expect(await claimRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
  });

  it("should deploy basic contracts", async function () {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const MockOracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await MockOracle.deploy();

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const configRegistry = await ConfigRegistry.deploy(deployerAddress);

    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    const memberRegistry = await MemberRegistry.deploy(deployerAddress);

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployerAddress, await usdc.getAddress(), 300);

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    const preBuffer = await PreTrancheBuffer.deploy(
      deployerAddress, 
      await usdc.getAddress(), 
      await memberRegistry.getAddress(), 
      await configRegistry.getAddress()
    );

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    const bricsToken = await BRICSToken.deploy(deployerAddress, await memberRegistry.getAddress());

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    const redemptionClaim = await RedemptionClaim.deploy(
      deployerAddress, 
      await memberRegistry.getAddress(), 
      await configRegistry.getAddress()
    );

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    const trancheManager = await TrancheManagerV2.deploy(
      deployerAddress, 
      await oracle.getAddress(), 
      await configRegistry.getAddress()
    );

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    const claimRegistry = await ClaimRegistry.deploy(deployerAddress);

    // Now try to deploy IssuanceControllerV3
    const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
    const issuanceController = await IssuanceControllerV3.deploy(
      deployerAddress,
      await bricsToken.getAddress(),
      await trancheManager.getAddress(),
      await configRegistry.getAddress(),
      await oracle.getAddress(),
      await usdc.getAddress(),
      await treasury.getAddress(),
      await redemptionClaim.getAddress(),
      await preBuffer.getAddress(),
      await claimRegistry.getAddress()
    );

    expect(await issuanceController.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});
