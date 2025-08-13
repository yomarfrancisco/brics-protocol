import { task } from "hardhat/config";
import fs from "node:fs";
import path from "node:path";

type AddressLike = string | { address: string };

async function toAddr(x: AddressLike): Promise<string> {
  if (!x) throw new Error("toAddr: got falsy");
  if (typeof x === "string") return x;
  if ((x as any).address) return (x as any).address;
  if ((x as any).getAddress) return await (x as any).getAddress();
  throw new Error("toAddr: unsupported type");
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function writeJson(p: string, obj: any) {
  await ensureDir(path.dirname(p));
  await fs.promises.writeFile(p, JSON.stringify(obj, null, 2));
}

task("dev:bootstrap", "Deploys a local dev stack and seeds balances")
  .addOptionalParam("usdc", "Existing USDC address (optional)")
  .addOptionalParam("brics", "Existing BRICS address (optional)")
  .setAction(async (args: any, hre: any) => {
    const { ethers } = hre;
    const [deployer, treasury, whale, member] = await hre.ethers.getSigners();

    // 1) USDC: attach or deploy MockUSDC (6 decimals)
    let usdc;
    if (args.usdc) {
      const ERC20 = await ethers.getContractFactory("IERC20");
      usdc = ERC20.attach(args.usdc);
    } else {
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      usdc = await MockUSDC.deploy();
      await usdc.waitForDeployment();
    }

    // 2) BRICS: attach or deploy MockBRICSToken (18 decimals)
    let brics;
    if (args.brics) {
      const ERC20 = await ethers.getContractFactory("IERC20");
      brics = ERC20.attach(args.brics);
    } else {
      const MockBRICS = await ethers.getContractFactory("MockBRICSToken");
      brics = await MockBRICS.deploy();
      await brics.waitForDeployment();
      // Default mint & allocate
      await (brics as any).mint(await toAddr(treasury), ethers.parseUnits("10000000", 18)); // 10M
      await (brics as any).mint(await toAddr(whale),    ethers.parseUnits("50000000", 18)); // 50M
      await (brics as any).mint(await toAddr(deployer), ethers.parseUnits("1000000", 18));  // 1M
    }

    // 3) NAV oracle: deploy mock and set NAV=1.0 RAY
    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    const nav = await MockNAVOracle.deploy();
    await nav.waitForDeployment();
    // 1.0 in RAY (10^27)
    await (nav as any).setNavRay(ethers.parseUnits("1", 27));

    // 4) AMM & PMM mocks (if present), else skip gracefully
    let amm: any = null;
    let pmm: any = null;
    try {
      const MockAMM = await ethers.getContractFactory("MockAMM");
      amm = await MockAMM.deploy(await usdc.getAddress());
      await amm.waitForDeployment();
    } catch {}
    try {
      const MockPMM = await ethers.getContractFactory("MockPMM");
      pmm = await MockPMM.deploy(await usdc.getAddress());
      await pmm.waitForDeployment();
    } catch {}

    // 5) InstantLane (if available)
    let lane: any = null;
    try {
      const InstantLane = await ethers.getContractFactory("InstantLane");
      // Updated constructor signature with gov parameter
      lane = await InstantLane.deploy(
        await brics.getAddress(),
        await usdc.getAddress(),
        await nav.getAddress(),
        "0x0000000000000000000000000000000000000000", // member registry placeholder
        await amm.getAddress(),
        "0x0000000000000000000000000000000000000000", // config registry placeholder
        pmm ? await pmm.getAddress() : "0x0000000000000000000000000000000000000000",
        await toAddr(deployer) // gov parameter
      );
      await lane.waitForDeployment();
    } catch {}

    // 6) Seed balances (USDC & BRICS) for participants and venues
    const ONE_M_USDC = 1_000_000; // human, 6 decimals below
    const TWO_M_USDC = 2_000_000;

    const mintUSDC = async (to: AddressLike, human: number) => {
      // For MockUSDC (mintable)
      if (typeof (usdc as any).mint === "function") {
        await (usdc as any).mint(await toAddr(to), human * (10 ** 6));
      }
    };

    // Fund lane, amm, pmm, member with USDC if mintable
    await mintUSDC(lane ?? deployer, TWO_M_USDC);
    if (amm) await mintUSDC(amm, TWO_M_USDC);
    if (pmm) await mintUSDC(pmm, TWO_M_USDC);
    await mintUSDC(member, ONE_M_USDC);

    // Final addresses
    const out = {
      network: hre.network.name,
      deployer: await toAddr(deployer),
      treasury: await toAddr(treasury),
      whale: await toAddr(whale),
      member: await toAddr(member),
      usdc: await usdc.getAddress(),
      brics: await brics.getAddress(),
      nav: await nav.getAddress(),
      amm: amm ? await amm.getAddress() : null,
      pmm: pmm ? await pmm.getAddress() : null,
      lane: lane ? await lane.getAddress() : null
    };

    await writeJson(".devstack/addresses.json", out);
    console.log("Dev stack ready -> .devstack/addresses.json\n", out);
  });
