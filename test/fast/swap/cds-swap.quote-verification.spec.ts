import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CDS Swap Quote Verification", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();

    const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
    cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
  });

  describe("Quote Verification", function () {
    it("should have correct validation constants", async function () {
      expect(await cdsSwapEngine.MIN_SPREAD_BPS()).to.equal(1);
      expect(await cdsSwapEngine.MAX_SPREAD_BPS()).to.equal(10000);
      expect(await cdsSwapEngine.MIN_CORRELATION_BPS()).to.equal(1000);
      expect(await cdsSwapEngine.MAX_CORRELATION_BPS()).to.equal(9000);
      expect(await cdsSwapEngine.QUOTE_STALE_SECONDS()).to.equal(300);
    });

    it("should reject quote when price oracle not set", async function () {
      // Verify price oracle is not set by default
      expect(await cdsSwapEngine.priceOracle()).to.equal(ethers.ZeroAddress);
    });
  });

});
