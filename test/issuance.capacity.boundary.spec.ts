import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const SIG = "mintFor(address,uint256,uint256,uint256,bytes32)";

async function dumpInterface(ctrl:any) {
  console.log("Interface functions:");
  try {
    const frag = ctrl.interface.getFunction(SIG);
    console.log("EXPECTED mintFor:", frag.format(), "selector:", frag.selector);
  } catch (error) {
    console.log("Error getting mintFor function:", error);
  }
}

async function assertSelector(controller: any) {
  // 1) Ensure function exists on the interface we're using
  const fn = controller.interface.getFunction(SIG);
  console.log("mintFor fragment:", fn.format());
  // 2) Verify the function exists
  console.log("Function selector:", fn.selector);
}

async function deployFixture() {
  const [deployer, ops, user] = await ethers.getSigners();

  await time.increase(1000);

  // Deploy USDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();

  // Deploy MockNAVOracle
  const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
  const oracle = await MockNAVOracle.deploy();

  // NAV mock must have setNavRay + the getters controller reads
  await oracle.setNavRay(1_000000000000000000000000000n); // 1.0 RAY

  // Deploy ConfigRegistry
  const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
  const cfg = await ConfigRegistry.deploy(deployer.address);
  await cfg.connect(deployer).grantRole(await cfg.GOV_ROLE(), deployer.address);

  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address, await usdc.getAddress(), 300);

  // Deploy MemberRegistry
  const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
  const member = await MemberRegistry.deploy(deployer.address);
  await member.connect(deployer).setRegistrar(deployer.address);
  await member.connect(deployer).setMember(user.address, true);

  // Deploy PreTrancheBuffer
  const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
  const preBuffer = await PreTrancheBuffer.deploy(deployer.address, await usdc.getAddress(), await member.getAddress(), await cfg.getAddress());

  // Deploy BRICSToken
  const BRICSToken = await ethers.getContractFactory("BRICSToken");
  const token = await BRICSToken.deploy(deployer.address, await member.getAddress());

  // Deploy RedemptionClaim
  const RedemptionClaim = await ethers.getContractFactory("RedemptionClaim");
  const claim = await RedemptionClaim.deploy(deployer.address, await member.getAddress(), await cfg.getAddress());

  // Deploy TrancheManagerV2
  const TrancheManagerV2 = await ethers.getContractFactory("TrancheManagerV2");
  const tranche = await TrancheManagerV2.deploy(deployer.address, await oracle.getAddress(), await cfg.getAddress());
  await tranche.connect(deployer).adjustSuperSeniorCap(ethers.parseEther("10000000"));

  // Deploy ClaimRegistry
  const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
  const claimReg = await ClaimRegistry.deploy(deployer.address);

  // Deploy IssuanceControllerV3
  const IssuanceControllerV3 = await ethers.getContractFactory("IssuanceControllerV3");
  const controller = await IssuanceControllerV3.deploy(
    deployer.address,
    await token.getAddress(),
    await tranche.getAddress(),
    await cfg.getAddress(),
    await oracle.getAddress(),
    await usdc.getAddress(),
    await treasury.getAddress(),
    await claim.getAddress(),
    await preBuffer.getAddress(),
    await claimReg.getAddress()
  );

  // Configure sovereign
  const SOV = ethers.encodeBytes32String("TEST_SOV");
  await cfg.connect(deployer).addSovereign(
    SOV,            // code
    8_000,          // utilCapBps
    2_000,          // haircutBps
    5_000,          // weightBps
    true            // enabled
  );

  // Set sovereign caps
  const softCap = 640n * 10n**6n; // 640 USDC
  const hardCap = 1280n * 10n**6n; // 1280 USDC
  await controller.connect(deployer).setSovereignCap(SOV, softCap, hardCap);

  // Grant roles
  await token.connect(deployer).grantRole(await token.MINTER_ROLE(), await controller.getAddress());
  await controller.connect(deployer).grantRole(await controller.OPS_ROLE(), ops.address);

  // Fund ops & approve controller
  await usdc.mint(ops.address, 1_000_000n * 10n**6n);
  await usdc.connect(ops).approve(await controller.getAddress(), 1_000_000n * 10n**6n);

  // Fund treasury
  await usdc.mint(await treasury.getAddress(), 5_000_000n * 10n**6n);

  // Prove we're talking to the actual implementation (not a mismatched proxy)
  const ctrlAddr = await controller.getAddress();
  const code = await ethers.provider.getCode(ctrlAddr);
  console.log("controller code size:", code.length); // if small → proxy
  if (code.length < 200) {
    // if proxy, resolve implementation slot (standard EIP-1967), then dump its selectors too
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const impl = await ethers.provider.getStorage(ctrlAddr, implSlot);
    const implAddr = "0x" + impl.slice(26);
    console.log("proxy impl:", implAddr);
    const Impl = new ethers.Contract(implAddr, controller.interface, (await ethers.getSigners())[0]);
    await dumpInterface(Impl);
  }

  return { controller, usdc, ops, user, cfg, oracle, SOV };
}

describe("SPEC §3 — Capacity boundary", () => {
  it("mints exactly at effective cap (pass)", async () => {
    const fx = await loadFixture(deployFixture);
    await dumpInterface(fx.controller);

    // Get the actual effective capacity from the controller
    const debug = await fx.controller.getSovereignCapacityDebug(fx.SOV);
    const capUSDC: bigint = BigInt(debug.capUSDC);
    console.log("Effective capacity:", capUSDC.toString());
    console.log("Debug values:", {
      capUSDC: debug.capUSDC.toString(),
      remUSDC: debug.remUSDC.toString(),
      usedUSDC: debug.usedUSDC.toString(),
      softCap: debug.softCap?.toString() || "undefined",
      capBps: debug.capBps?.toString() || "undefined"
    });

    const SIG = "mintFor(address,uint256,uint256,uint256,bytes32)";
    const data = fx.controller.interface.encodeFunctionData(SIG, [fx.user.address, capUSDC, 0n, 0n, fx.SOV]);
    const [to, amt, tailCorrPpm, sovUtilBps, sovereignCode] = fx.controller.interface.decodeFunctionData(SIG, data) as [string,bigint,bigint,bigint,string];
    expect(amt).to.equal(capUSDC); 
    expect(tailCorrPpm).to.equal(0n);
    expect(sovUtilBps).to.equal(0n);

    // pre-flight: callStatic to see revert reason comes from contract logic
    try {
      await fx.ops.call({ to: await fx.controller.getAddress(), data });
      console.log("Static call succeeded");
    } catch (error) {
      console.log("Static call failed:", error.message);
      throw error;
    }

    // live tx
    await expect( fx.ops.sendTransaction({ to: await fx.controller.getAddress(), data }) )
      .to.not.be.reverted;
  });

  it("mints at cap + 1 wei (revert)", async () => {
    const fx = await loadFixture(deployFixture);
    await dumpInterface(fx.controller);

    const SIG = "mintFor(address,uint256,uint256,uint256,bytes32)";
    const amount = 640n * 10n**6n;
    const capPlus1 = amount + 1n;
    const data = fx.controller.interface.encodeFunctionData(SIG, [fx.user.address, capPlus1, 0n, 0n, fx.SOV]);

    // optional: if controller exposes a specific custom error, assert it
    await expect( fx.ops.sendTransaction({ to: await fx.controller.getAddress(), data }) )
      .to.be.reverted;
  });

  it("harness proves parameters reach contract boundary", async () => {
    const fx = await loadFixture(deployFixture);
    
    // Deploy harness
    const IssuanceHarness = await ethers.getContractFactory("IssuanceHarness");
    const harness = await IssuanceHarness.deploy();
    
    // Grant OPS_ROLE to harness
    const [deployer] = await ethers.getSigners();
    await fx.controller.connect(deployer).grantRole(await fx.controller.OPS_ROLE(), await harness.getAddress());
    
    const amount = 100n * 10n**6n; // 100 USDC
    
    // Call through harness to see what parameters reach the contract
    const tx = await harness.connect(fx.ops).proxyMint(
      await fx.controller.getAddress(),
      fx.user.address,
      amount,
      0n,
      0n,
      fx.SOV
    );
    
    // Check the Seen event to verify parameters
    const receipt = await tx.wait();
    const seenEvent = receipt?.logs.find(log => {
      try {
        const parsed = harness.interface.parseLog(log);
        return parsed?.name === "Seen";
      } catch {
        return false;
      }
    });
    
    expect(seenEvent).to.not.be.undefined;
    const parsed = harness.interface.parseLog(seenEvent!);
    expect(parsed?.args.usdcAmt).to.equal(amount);
    expect(parsed?.args.to).to.equal(fx.user.address);
  });
});
