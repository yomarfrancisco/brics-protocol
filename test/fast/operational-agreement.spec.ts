import { expect } from "chai";
import { ethers } from "hardhat";
import { OperationalAgreement } from "../../typechain-types";
import { MemberRegistry } from "../../typechain-types";

describe("OperationalAgreement Fast Tests", function () {
  let operationalAgreement: OperationalAgreement;
  let memberRegistry: MemberRegistry;
  let nasasa: any;
  let spv: any;
  let operator: any;
  let user: any;
  let pool: any;

  beforeEach(async function () {
    [nasasa, spv, operator, user, pool] = await ethers.getSigners();

    // Deploy MemberRegistry first
    const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
    memberRegistry = await MemberRegistry.deploy(await spv.getAddress());

    // Deploy OperationalAgreement
    const OperationalAgreement = await ethers.getContractFactory("OperationalAgreement");
    operationalAgreement = await OperationalAgreement.deploy(
      await nasasa.getAddress(),
      await spv.getAddress(),
      await memberRegistry.getAddress()
    );

    // Set OperationalAgreement as the registrar in MemberRegistry
    await memberRegistry.connect(spv).setRegistrar(await operationalAgreement.getAddress());
  });

  describe("Constructor and Role Setup", function () {
    it("should deploy with correct roles and registry", async function () {
      // Check that roles are assigned correctly
      expect(await operationalAgreement.hasRole(await operationalAgreement.DEFAULT_ADMIN_ROLE(), await spv.getAddress())).to.be.true;
      expect(await operationalAgreement.hasRole(await operationalAgreement.NASASA_ROLE(), await nasasa.getAddress())).to.be.true;
      expect(await operationalAgreement.hasRole(await operationalAgreement.SPV_ROLE(), await spv.getAddress())).to.be.true;
      
      // Check registry is set correctly
      expect(await operationalAgreement.registry()).to.equal(await memberRegistry.getAddress());
    });

    it("should revert constructor with zero addresses", async function () {
      const OperationalAgreement = await ethers.getContractFactory("OperationalAgreement");
      
      // Test with zero nasasa
      await expect(
        OperationalAgreement.deploy(ethers.ZeroAddress, await spv.getAddress(), await memberRegistry.getAddress())
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");

      // Test with zero spv
      await expect(
        OperationalAgreement.deploy(await nasasa.getAddress(), ethers.ZeroAddress, await memberRegistry.getAddress())
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");

      // Test with zero registry
      await expect(
        OperationalAgreement.deploy(await nasasa.getAddress(), await spv.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");
    });
  });

  describe("setOperator", function () {
    it("should allow SPV to set operator", async function () {
      await expect(operationalAgreement.connect(spv).setOperator(await operator.getAddress(), true))
        .to.emit(operationalAgreement, "OperatorSet")
        .withArgs(await operator.getAddress(), true);

      expect(await operationalAgreement.hasRole(await operationalAgreement.OPERATOR_ROLE(), await operator.getAddress())).to.be.true;
    });

    it("should allow SPV to revoke operator", async function () {
      // First grant the role
      await operationalAgreement.connect(spv).setOperator(await operator.getAddress(), true);
      
      // Then revoke it
      await expect(operationalAgreement.connect(spv).setOperator(await operator.getAddress(), false))
        .to.emit(operationalAgreement, "OperatorSet")
        .withArgs(await operator.getAddress(), false);

      expect(await operationalAgreement.hasRole(await operationalAgreement.OPERATOR_ROLE(), await operator.getAddress())).to.be.false;
    });

    it("should revert setOperator with zero address", async function () {
      await expect(
        operationalAgreement.connect(spv).setOperator(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");
    });

    it("should revert setOperator when not SPV", async function () {
      await expect(
        operationalAgreement.connect(nasasa).setOperator(await operator.getAddress(), true)
      ).to.be.reverted;
    });
  });

  describe("Member Management", function () {
    beforeEach(async function () {
      // Set up operator role for testing
      await operationalAgreement.connect(spv).setOperator(await operator.getAddress(), true);
    });

    it("should allow NASASA to approve member", async function () {
      await expect(operationalAgreement.connect(nasasa).approveMember(await user.getAddress()))
        .to.emit(operationalAgreement, "MemberApproved")
        .withArgs(await user.getAddress());

      expect(await memberRegistry.canReceive(await user.getAddress())).to.be.true;
    });

    it("should allow SPV to approve member", async function () {
      await expect(operationalAgreement.connect(spv).approveMember(await user.getAddress()))
        .to.emit(operationalAgreement, "MemberApproved")
        .withArgs(await user.getAddress());

      expect(await memberRegistry.canReceive(await user.getAddress())).to.be.true;
    });

    it("should allow operator to approve member", async function () {
      await expect(operationalAgreement.connect(operator).approveMember(await user.getAddress()))
        .to.emit(operationalAgreement, "MemberApproved")
        .withArgs(await user.getAddress());

      expect(await memberRegistry.canReceive(await user.getAddress())).to.be.true;
    });

    it("should allow NASASA to revoke member", async function () {
      // First approve the member
      await operationalAgreement.connect(nasasa).approveMember(await user.getAddress());
      
      // Then revoke
      await expect(operationalAgreement.connect(nasasa).revokeMember(await user.getAddress()))
        .to.emit(operationalAgreement, "MemberRevoked")
        .withArgs(await user.getAddress());

      expect(await memberRegistry.canReceive(await user.getAddress())).to.be.false;
    });

    it("should revert member operations with zero address", async function () {
      await expect(
        operationalAgreement.connect(nasasa).approveMember(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");

      await expect(
        operationalAgreement.connect(nasasa).revokeMember(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");
    });

    it("should revert member operations when not authorized", async function () {
      await expect(
        operationalAgreement.connect(user).approveMember(await user.getAddress())
      ).to.be.revertedWithCustomError(operationalAgreement, "Unauthorized");

      await expect(
        operationalAgreement.connect(user).revokeMember(await user.getAddress())
      ).to.be.revertedWithCustomError(operationalAgreement, "Unauthorized");
    });
  });

  describe("Pool Whitelisting", function () {
    beforeEach(async function () {
      // Set up operator role for testing
      await operationalAgreement.connect(spv).setOperator(await operator.getAddress(), true);
    });

    it("should allow NASASA to whitelist pool", async function () {
      await expect(operationalAgreement.connect(nasasa).whitelistPool(await pool.getAddress(), true))
        .to.emit(operationalAgreement, "PoolWhitelisted")
        .withArgs(await pool.getAddress(), true);

      expect(await memberRegistry.canReceive(await pool.getAddress())).to.be.true;
    });

    it("should allow SPV to whitelist pool", async function () {
      await expect(operationalAgreement.connect(spv).whitelistPool(await pool.getAddress(), true))
        .to.emit(operationalAgreement, "PoolWhitelisted")
        .withArgs(await pool.getAddress(), true);

      expect(await memberRegistry.canReceive(await pool.getAddress())).to.be.true;
    });

    it("should allow operator to whitelist pool", async function () {
      await expect(operationalAgreement.connect(operator).whitelistPool(await pool.getAddress(), true))
        .to.emit(operationalAgreement, "PoolWhitelisted")
        .withArgs(await pool.getAddress(), true);

      expect(await memberRegistry.canReceive(await pool.getAddress())).to.be.true;
    });

    it("should allow removing pool from whitelist", async function () {
      // First whitelist the pool
      await operationalAgreement.connect(nasasa).whitelistPool(await pool.getAddress(), true);
      
      // Then remove it
      await expect(operationalAgreement.connect(nasasa).whitelistPool(await pool.getAddress(), false))
        .to.emit(operationalAgreement, "PoolWhitelisted")
        .withArgs(await pool.getAddress(), false);

      expect(await memberRegistry.canReceive(await pool.getAddress())).to.be.false;
    });

    it("should revert pool whitelisting with zero address", async function () {
      await expect(
        operationalAgreement.connect(nasasa).whitelistPool(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(operationalAgreement, "ZeroAddress");
    });

    it("should revert pool whitelisting when not authorized", async function () {
      await expect(
        operationalAgreement.connect(user).whitelistPool(await pool.getAddress(), true)
      ).to.be.revertedWithCustomError(operationalAgreement, "Unauthorized");
    });
  });
});
