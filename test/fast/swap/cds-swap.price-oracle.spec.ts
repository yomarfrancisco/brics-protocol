import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CDS Swap Price Oracle", function () {
  let cdsSwapEngine: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const ZERO_ADDRESS = ethers.ZeroAddress;

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    const CdsSwapEngine = await ethers.getContractFactory("CdsSwapEngine");
    cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
  });

  describe("Price Oracle Adapter", function () {
    it("should allow gov role to set price oracle", async function () {
      const tx = await cdsSwapEngine.setPriceOracle(user1.address);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "PriceOracleSet"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.priceOracle).to.equal(user1.address);
      expect(await cdsSwapEngine.priceOracle()).to.equal(user1.address);
    });

    it("should prevent non-gov role from setting price oracle", async function () {
      await expect(
        cdsSwapEngine.connect(user1).setPriceOracle(user2.address)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "Unauthorized");
    });

    it("should prevent setting zero address as price oracle", async function () {
      await expect(
        cdsSwapEngine.setPriceOracle(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(cdsSwapEngine, "InvalidParams");
    });

    it("should emit PriceOracleSet event", async function () {
      const tx = await cdsSwapEngine.setPriceOracle(user1.address);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "PriceOracleSet"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.priceOracle).to.equal(user1.address);
    });

    it("should allow updating price oracle", async function () {
      // Set initial oracle
      await cdsSwapEngine.setPriceOracle(user1.address);
      expect(await cdsSwapEngine.priceOracle()).to.equal(user1.address);
      
      // Update oracle
      const tx = await cdsSwapEngine.setPriceOracle(user2.address);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === "PriceOracleSet"
      );
      
      expect(event.args.priceOracle).to.equal(user2.address);
      expect(await cdsSwapEngine.priceOracle()).to.equal(user2.address);
    });
  });
});
