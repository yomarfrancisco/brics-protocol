import { expect } from "chai";
import { ethers } from "hardhat";

describe("Sovereign Guarantee Simple Test", function () {
  it("should deploy ClaimRegistry", async function () {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    const claimRegistry = await ClaimRegistry.deploy(deployerAddress);
    
    expect(await claimRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
    console.log("ClaimRegistry deployed at:", await claimRegistry.getAddress());
  });

  it("should deploy basic contracts", async function () {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    console.log("MockUSDC deployed at:", await usdc.getAddress());

    const MockOracle = await ethers.getContractFactory("MockNAVOracle");
    const oracle = await MockOracle.deploy();
    console.log("MockOracle deployed at:", await oracle.getAddress());

    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const configRegistry = await ConfigRegistry.deploy(deployerAddress);
    console.log("ConfigRegistry deployed at:", await configRegistry.getAddress());

    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    const memberRegistry = await MemberRegistry.deploy(deployerAddress);
    console.log("MemberRegistry deployed at:", await memberRegistry.getAddress());

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployerAddress, await usdc.getAddress(), 300);
    console.log("Treasury deployed at:", await treasury.getAddress());

    const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
    const preBuffer = await PreTrancheBuffer.deploy(
      deployerAddress, 
      await usdc.getAddress(), 
      await memberRegistry.getAddress(), 
      await configRegistry.getAddress()
    );
    console.log("PreTrancheBuffer deployed at:", await preBuffer.getAddress());

    const BRICSToken = await ethers.getContractFactory("BRICSToken");
    const bricsToken = await BRICSToken.deploy(deployerAddress, await memberRegistry.getAddress());
    console.log("BRICSToken deployed at:", await bricsToken.getAddress());

    const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
    const redemptionClaim = await RedemptionClaim.deploy(
      deployerAddress, 
      await memberRegistry.getAddress(), 
      await configRegistry.getAddress()
    );
    console.log("RedemptionClaim deployed at:", await redemptionClaim.getAddress());

    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    const trancheManager = await TrancheManagerV2.deploy(
      deployerAddress, 
      await oracle.getAddress(), 
      await configRegistry.getAddress()
    );
    console.log("TrancheManagerV2 deployed at:", await trancheManager.getAddress());

    const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
    const claimRegistry = await ClaimRegistry.deploy(deployerAddress);
    console.log("ClaimRegistry deployed at:", await claimRegistry.getAddress());

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
    console.log("IssuanceControllerV3 deployed at:", await issuanceController.getAddress());

    expect(await issuanceController.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});
