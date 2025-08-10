import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import hre from "hardhat";

async function main() {
  const path = `deployments-${hre.network.name}.json`;
  const state = JSON.parse(readFileSync(path, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const DAO = process.env.DAO_MULTISIG || deployer.address;

  let usdcAddr = process.env.USDC_ADDRESS;
  if (!usdcAddr || usdcAddr === "0xMockOrRealUSDCOnNetwork") {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    await (await usdc.mint(deployer.address, ethers.parseUnits("10000000", 6))).wait();
    usdcAddr = await usdc.getAddress();
  }

  // Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(DAO, usdcAddr, 300); // 3% default target bps
  await treasury.waitForDeployment();

  // PreTrancheBuffer
  const PreTrancheBuffer = await ethers.getContractFactory("PreTrancheBuffer");
  const pre = await PreTrancheBuffer.deploy(
    DAO,
    usdcAddr,
    state.core.MemberRegistry,
    state.core.ConfigRegistry
  );
  await pre.waitForDeployment();

  state.finance = {
    USDC: usdcAddr,
    Treasury: await treasury.getAddress(),
    PreTrancheBuffer: await pre.getAddress()
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
  console.log("Finance deployed:", state.finance);
}
main().catch((e) => { console.error(e); process.exit(1); });
