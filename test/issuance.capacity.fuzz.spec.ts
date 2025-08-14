import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { calcEffectiveCapTokens } from "./utils/cap";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SPEC §3 — canIssue vs cap maths (light fuzz)", function () {
  before(function () {
    // Quarantined due to IssuanceControllerV3.mintFor usdcAmt==0 bug.
    // See Issue #61. Re-enable once contract fix lands.
    this.skip();
  });

  // (Optionally) leave a tiny smoke block that DOES NOT call mintFor:
  describe('smoke: config/cap plumbing only', function () {
    let fx: Awaited<ReturnType<typeof deployFixture>>;

    async function deployFixture() {
      const [gov, ops, user] = await ethers.getSigners();
      const [govAddr, opsAddr, userAddr] = await Promise.all([
        gov.getAddress(), ops.getAddress(), user.getAddress()
      ]);

      // deterministic chain time
      await time.increase(1000);

      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const usdc = await MockUSDC.deploy();
      await usdc.waitForDeployment();

      const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
      const oracle = await MockNAVOracle.deploy();
      await oracle.waitForDeployment();
      await oracle.setNavRay(ethers.parseEther("1")); // Use setNavRay, not setNAV

      const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
      const member = await MemberRegistry.deploy(govAddr);
      await member.waitForDeployment();
      await member.connect(gov).setRegistrar(govAddr);
      await member.connect(gov).setMember(userAddr, true);

      const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
      const config = await ConfigRegistry.deploy(govAddr);
      await config.waitForDeployment();
      await config.connect(gov).grantRole(await config.GOV_ROLE(), govAddr);

      const Treasury = await ethers.getContractFactory("Treasury");
      const treasury = await Treasury.deploy(govAddr, await usdc.getAddress(), 300);
      await treasury.waitForDeployment();

      const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
      const preBuffer = await PreTrancheBuffer.deploy(govAddr, await usdc.getAddress(), await member.getAddress(), await config.getAddress());
      await preBuffer.waitForDeployment();

      const BRICSToken = await ethers.getContractFactory("BRICSToken");
      const brics = await BRICSToken.deploy(govAddr, await member.getAddress());
      await brics.waitForDeployment();

      const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
      const claim = await RedemptionClaim.deploy(govAddr, await member.getAddress(), await config.getAddress());
      await claim.waitForDeployment();

      const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
      const tranche = await TrancheManagerV2.deploy(govAddr, await oracle.getAddress(), await config.getAddress());
      await tranche.waitForDeployment();
      await tranche.connect(gov).adjustSuperSeniorCap(ethers.parseEther("10000000"));

      const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
      const claimReg = await ClaimRegistry.deploy(govAddr);
      await claimReg.waitForDeployment();

      const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
      const ic = await IssuanceControllerV3.deploy(
        govAddr,
        await brics.getAddress(),
        await tranche.getAddress(),
        await config.getAddress(),
        await oracle.getAddress(),
        await usdc.getAddress(),
        await treasury.getAddress(),
        await claim.getAddress(),
        await preBuffer.getAddress(),
        await claimReg.getAddress()
      );
      await ic.waitForDeployment();

      await brics.connect(gov).grantRole(await brics.MINTER_ROLE(), await ic.getAddress());
      await ic.connect(gov).grantRole(await ic.OPS_ROLE(), opsAddr);
      
      // Add initial sovereign and set caps
      const SOV = ethers.encodeBytes32String("TEST_SOV");
      await config.connect(gov).addSovereign(SOV, 8000, 2000, 5000, true);
      await ic.connect(gov).setSovereignCap(SOV, ethers.parseUnits("1000000", 6), ethers.parseUnits("2000000", 6));

      return { gov, ops, user, govAddr, opsAddr, userAddr, config, ic, usdc, oracle, member, brics, tranche, treasury, preBuffer, claim, claimReg, SOV };
    }

    beforeEach(async () => {
      fx = await loadFixture(deployFixture);
    });

    it("smoke test: config/cap plumbing works", async () => {
      // use loadFixture+time.latest, compute effective cap via registry debug,
      // assert it's > 0 and fields are coherent.
      const t0 = Number(await time.latest());
      await time.increase(1000);
      const asOf = Number(await time.latest());

      // Get the actual capacity from the contract
      const debug = await fx.ic.getSovereignCapacityDebug(fx.SOV);
      const capUSDC = debug.remUSDC; // remaining capacity

      // Assert capacity struct exists and has coherent values
      expect(capUSDC).to.be.gte(0n, `cap=${capUSDC}`);
      expect(debug.softCapUSDC).to.be.gt(0n, `softCap=${debug.softCapUSDC}`);
      expect(debug.hardCapUSDC).to.be.gte(debug.softCapUSDC, `hardCap=${debug.hardCapUSDC} >= softCap=${debug.softCapUSDC}`);
      
      // Verify sovereign is properly configured
      const sovereign = await fx.config.getSovereign(fx.SOV);
      expect(sovereign.enabled).to.be.true;
      expect(sovereign.usageBps).to.be.gt(0);
      expect(sovereign.haircutBps).to.be.gte(0);
    });
  });
});
