import { expect } from "chai";
import { ethers } from "hardhat";
import { AdaptiveTranchingOracleAdapter } from "../../../typechain-types";
import { TrancheManagerV2 } from "../../../typechain-types";

describe("AdaptiveTranchingOracleAdapter Fast Tests", function () {
  let adapter: AdaptiveTranchingOracleAdapter;
  let trancheManager: TrancheManagerV2;
  let gov: any;
  let oracle: any;
  let user: any;

  beforeEach(async function () {
    [gov, oracle, user] = await ethers.getSigners();

    // Deploy TrancheManagerV2 first (mock for testing)
    const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
    trancheManager = await TrancheManagerV2.deploy(
      await gov.getAddress(),
      await gov.getAddress(), // mock oracle
      await gov.getAddress()  // mock config
    );

    // Deploy adapter
    const AdaptiveTranchingOracleAdapter = await ethers.getContractFactory("AdaptiveTranchingOracleAdapter");
    adapter = await AdaptiveTranchingOracleAdapter.deploy(
      await gov.getAddress(),
      await trancheManager.getAddress(),
      await oracle.getAddress() // risk oracle
    );
  });

  describe("Constructor and Setup", function () {
    it("should deploy with correct roles", async function () {
      expect(await adapter.hasRole(await adapter.DEFAULT_ADMIN_ROLE(), await gov.getAddress())).to.be.true;
      expect(await adapter.hasRole(await adapter.GOV_ROLE(), await gov.getAddress())).to.be.true;
      expect(await adapter.hasRole(await adapter.ORACLE_ROLE(), await gov.getAddress())).to.be.true;
    });

    it("should set correct target contract", async function () {
      expect(await adapter.targetContract()).to.equal(await trancheManager.getAddress());
    });
  });

  describe("Role Management", function () {
    it("should allow admin to grant oracle role", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      expect(await adapter.hasOracleRole(await oracle.getAddress())).to.be.true;
    });

    it("should allow admin to revoke oracle role", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      await adapter.revokeOracleRole(await oracle.getAddress());
      expect(await adapter.hasOracleRole(await oracle.getAddress())).to.be.false;
    });

    it("should revert when non-admin grants oracle role", async function () {
      await expect(
        adapter.connect(user).grantOracleRole(await oracle.getAddress())
      ).to.be.revertedWithCustomError(adapter, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Signal Submission", function () {
    let validSignal: any;

    beforeEach(async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      validSignal = {
        sovereignUsageBps: 2000,
        portfolioDefaultsBps: 500,
        corrPpm: 300000,
        asOf: currentBlock!.timestamp
      };
    });

    it("should allow gov to submit signal", async function () {
      await adapter.connect(gov).submitSignal(validSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(validSignal.sovereignUsageBps);
      expect(lastSignal.portfolioDefaultsBps).to.equal(validSignal.portfolioDefaultsBps);
      expect(lastSignal.corrPpm).to.equal(validSignal.corrPpm);
      expect(lastSignal.asOf).to.equal(validSignal.asOf);
    });

    it("should allow oracle to submit signal", async function () {
      await adapter.grantOracleRole(await oracle.getAddress());
      await adapter.connect(oracle).submitSignal(validSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(validSignal.sovereignUsageBps);
    });

    it("should revert when unauthorized user submits signal", async function () {
      await expect(
        adapter.connect(user).submitSignal(validSignal)
      ).to.be.revertedWith("unauthorized");
    });

    it("should validate sovereign usage <= 100%", async function () {
      const invalidSignal = { ...validSignal, sovereignUsageBps: 10001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("sovereign usage > 100%");
    });

    it("should validate portfolio defaults <= 100%", async function () {
      const invalidSignal = { ...validSignal, portfolioDefaultsBps: 10001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("defaults > 100%");
    });

    it("should validate correlation <= 100%", async function () {
      const invalidSignal = { ...validSignal, corrPpm: 1000001 };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("correlation > 100%");
    });

    it("should validate timestamp is not in future", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const futureTimestamp = currentBlock!.timestamp + 86400; // 24 hours in future
      const invalidSignal = { ...validSignal, asOf: futureTimestamp };
      await expect(
        adapter.connect(gov).submitSignal(invalidSignal)
      ).to.be.revertedWith("future timestamp");
    });
  });

  describe("Getters", function () {
    it("should return DISABLED mode when target doesn't implement", async function () {
      // Deploy adapter with non-implementing target
      const MockContract = await ethers.getContractFactory("MockUSDC");
      const mockTarget = await MockContract.deploy();
      
      const newAdapter = await (await ethers.getContractFactory("AdaptiveTranchingOracleAdapter")).deploy(
        await gov.getAddress(),
        await mockTarget.getAddress(),
        await oracle.getAddress()
      );
      
      expect(await newAdapter.getTranchingMode()).to.equal(0); // DISABLED
    });

    it("should return default thresholds when target doesn't implement", async function () {
      const MockContract = await ethers.getContractFactory("MockUSDC");
      const mockTarget = await MockContract.deploy();
      
      const newAdapter = await (await ethers.getContractFactory("AdaptiveTranchingOracleAdapter")).deploy(
        await gov.getAddress(),
        await mockTarget.getAddress(),
        await oracle.getAddress()
      );
      
      const [sovereignUsage, defaults, correlation] = await newAdapter.getTranchingThresholds();
      expect(sovereignUsage).to.equal(2000);
      expect(defaults).to.equal(1000);
      expect(correlation).to.equal(650000);
    });

    it("should return mode from target when it implements the interface", async function () {
      // Set mode in tranche manager
      await trancheManager.connect(gov).setTranchingMode(2); // ENFORCED
      
      expect(await adapter.getTranchingMode()).to.equal(2);
    });

    it("should return thresholds from target when it implements the interface", async function () {
      // Set thresholds in tranche manager
      await trancheManager.connect(gov).setTranchingThresholds(3000, 1500, 700000);
      
      const [sovereignUsage, defaults, correlation] = await adapter.getTranchingThresholds();
      expect(sovereignUsage).to.equal(3000);
      expect(defaults).to.equal(1500);
      expect(correlation).to.equal(700000);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero address oracle role grant", async function () {
      await expect(
        adapter.grantOracleRole(ethers.ZeroAddress)
      ).to.be.revertedWith("oracle cannot be zero address");
    });

    it("should handle signal with maximum valid values", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const maxSignal = {
        sovereignUsageBps: 10000,
        portfolioDefaultsBps: 10000,
        corrPpm: 1000000,
        asOf: currentBlock!.timestamp
      };
      
      await adapter.connect(gov).submitSignal(maxSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(10000);
      expect(lastSignal.portfolioDefaultsBps).to.equal(10000);
      expect(lastSignal.corrPpm).to.equal(1000000);
    });

    it("should handle signal with minimum valid values", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const minSignal = {
        sovereignUsageBps: 0,
        portfolioDefaultsBps: 0,
        corrPpm: 0,
        asOf: currentBlock!.timestamp
      };
      
      await adapter.connect(gov).submitSignal(minSignal);
      
      const lastSignal = await adapter.lastSignal();
      expect(lastSignal.sovereignUsageBps).to.equal(0);
      expect(lastSignal.portfolioDefaultsBps).to.equal(0);
      expect(lastSignal.corrPpm).to.equal(0);
    });
  });

  describe("Signed Signal Submission", function () {
    let riskOracle: any;
    let mockRiskSignalLib: any;

    beforeEach(async function () {
      // Use a deterministic private key for the risk oracle
      const RISK_ORACLE_PRIV_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
      riskOracle = new ethers.Wallet(RISK_ORACLE_PRIV_KEY, ethers.provider);

      // Deploy mock RiskSignalLib for testing
      const MockRiskSignalLib = await ethers.getContractFactory("MockRiskSignalLib");
      mockRiskSignalLib = await MockRiskSignalLib.deploy();

      // Set the risk oracle directly from the deterministic PK
      await adapter.setRiskOracle(await riskOracle.getAddress());
    });

    // Helper function to sign a payload with the current risk oracle
    async function signPayload(payload: any) {
      const digest = await mockRiskSignalLib.digest(payload);
      const signature = await riskOracle.signMessage(ethers.getBytes(digest));
      
      // Guard assertion: verify the signature is valid
      const recovered = await mockRiskSignalLib.recoverSigner(digest, signature);
      expect(recovered).to.equal(await adapter.riskOracle());
      
      return signature;
    }

    it("should accept valid signed signal", async function () {
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const signature = await signPayload(payload);

      await expect(adapter.submitSignedRiskSignal(payload, signature))
        .to.emit(adapter, "SignalCached");
    });

    it("should reject signal with wrong signer", async function () {
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const digest = await mockRiskSignalLib.digest(payload);
      // Use a different signer
      const wrongSigner = new ethers.Wallet("0x1234567890123456789012345678901234567890123456789012345678901234", ethers.provider);
      const signature = await wrongSigner.signMessage(ethers.getBytes(digest));

      await expect(adapter.submitSignedRiskSignal(payload, signature))
        .to.be.revertedWith("bad-signer");
    });

    it("should reject signal with invalid correlation", async function () {
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60,
        riskScore: 123456789,
        correlationBps: 10001, // > 10000
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const signature = await signPayload(payload);

      await expect(adapter.submitSignedRiskSignal(payload, signature))
        .to.be.revertedWith("correlation > 100%");
    });

    it("should reject signal with invalid spread", async function () {
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 20001, // > 20000
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const signature = await signPayload(payload);

      await expect(adapter.submitSignedRiskSignal(payload, signature))
        .to.be.revertedWith("spread > 200%");
    });

    it("should reject signal with future timestamp", async function () {
      // Get current block timestamp and add a large offset to ensure it's in the future
      const currentBlock = await ethers.provider.getBlock('latest');
      const futureTimestamp = currentBlock.timestamp + 86400; // 24 hours in future
      
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: futureTimestamp,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const signature = await signPayload(payload);

      await expect(adapter.submitSignedRiskSignal(payload, signature))
        .to.be.revertedWith("future timestamp");
    });

    it("should cache the signal correctly", async function () {
      const payload = {
        portfolioId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asOf: Math.floor(Date.now() / 1000) - 60,
        riskScore: 123456789,
        correlationBps: 777,
        spreadBps: 1500,
        modelIdHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        featuresHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
      };

      const signature = await signPayload(payload);

      await adapter.submitSignedRiskSignal(payload, signature);

      // Check that the signal was cached
      const cachedSignal = await adapter.lastSignal();
      expect(cachedSignal.corrPpm).to.equal(payload.correlationBps * 100); // Convert bps to ppm
      expect(cachedSignal.asOf).to.equal(payload.asOf);
    });
  });

  describe("Risk Oracle Management", function () {
    it("should allow admin to set risk oracle", async function () {
      const [_, __, ___, newOracle] = await ethers.getSigners();
      await adapter.setRiskOracle(await newOracle.getAddress());
      expect(await adapter.riskOracle()).to.equal(await newOracle.getAddress());
    });

    it("should reject non-admin setting risk oracle", async function () {
      const [_, __, ___, newOracle] = await ethers.getSigners();
      await expect(
        adapter.connect(user).setRiskOracle(await newOracle.getAddress())
      ).to.be.revertedWithCustomError(adapter, "AccessControlUnauthorizedAccount");
    });

    it("should reject zero address risk oracle", async function () {
      await expect(
        adapter.setRiskOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("oracle cannot be zero address");
    });
  });
});
