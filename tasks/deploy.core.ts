import { task } from "hardhat/config";
import fs from "fs";

function loadParams(path: string) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

task("deploy:core", "Deterministic core deployment")
  .addParam("params", "Path to params JSON")
  .setAction(async ({ params }, hre) => {
    const p = loadParams(params);
    const { ethers } = hre;

    const [deployer] = await ethers.getSigners();
    const manifest: any = {
      network: p.network,
      chainId: p.chainId,
      version: p.version,
      txs: [],
      commit: process.env.GITHUB_SHA || "local",
      timestamp: new Date().toISOString()
    };

    const deploy = async (name: string, args: any[] = []) => {
      const f = await ethers.getContractFactory(name);
      const c = await f.deploy(...args);
      const r = await c.deploymentTransaction()?.wait(1);
      const addr = await c.getAddress();
      manifest.txs.push({ name, addr, block: r?.blockNumber, args });
      console.log(`${name} deployed: ${addr}`);
      return c;
    };

    console.log("Deploying BRICS core contracts...");

    // Core deploys
    const cfg = await deploy("ConfigRegistry", [p.addresses.GOV_SAFE]);
    const mem = await deploy("MemberRegistry", [p.addresses.GOV_SAFE]);
    const nav = await deploy("NAVOracleV3", [p.addresses.GOV_SAFE, p.oracle.modelHash]);
    const tm  = await deploy("TrancheManagerV2", [p.addresses.GOV_SAFE, await nav.getAddress(), await cfg.getAddress()]);
    const usdc = await ethers.getContractAt("IERC20", p.addresses.USDC);
    const tre = await deploy("Treasury", [p.addresses.GOV_SAFE, p.addresses.USDC, 300]);
    const pre = await deploy("PreTrancheBuffer", [p.addresses.GOV_SAFE, p.addresses.USDC, await mem.getAddress(), await cfg.getAddress()]);
    const tok = await deploy("BRICSToken", [p.addresses.GOV_SAFE, await mem.getAddress()]);
    const cla = await deploy("RedemptionClaim", [p.addresses.GOV_SAFE, await mem.getAddress(), await cfg.getAddress()]);
    const reg = await deploy("ClaimRegistry", [p.addresses.GOV_SAFE]);
    const ic  = await deploy("IssuanceControllerV3", [
      p.addresses.GOV_SAFE, await tok.getAddress(), await tm.getAddress(), await cfg.getAddress(),
      await nav.getAddress(), p.addresses.USDC, await tre.getAddress(),
      await cla.getAddress(), await pre.getAddress(), await reg.getAddress()
    ]);

    console.log("Configuring contracts...");

    // Sovereigns
    for (const s of p.sovereigns) {
      await cfg.connect(await ethers.getSigner(p.addresses.GOV_SAFE)).addSovereign(
        ethers.encodeBytes32String(s.code),
        s.utilCapBps, s.haircutBps, s.weightBps, s.enabled
      );
      await ic.connect(await ethers.getSigner(p.addresses.GOV_SAFE)).setSovereignCap(
        ethers.encodeBytes32String(s.code),
        s.softCapTokens, s.hardCapTokens
      );
      console.log(`Sovereign ${s.code} configured`);
    }

    // Caps, emergency
    await tm.connect(await ethers.getSigner(p.addresses.GOV_SAFE)).adjustSuperSeniorCap(p.caps.superSeniorCapTokens);
    console.log("Super senior cap set");

    if (p.emergency?.initialLevel !== undefined) {
      await cfg.connect(await ethers.getSigner(p.addresses.GOV_SAFE)).setEmergencyLevel(
        p.emergency.initialLevel, "init"
      );
      console.log("Emergency level set");
    }

    // Bootstrap seed (optional)
    if (p.bootstrap?.seedPreTrancheBufferUSDC !== "0") {
      await (await usdc.approve(await pre.getAddress(), p.bootstrap.seedPreTrancheBufferUSDC)).wait();
      await pre.fundBuffer(p.bootstrap.seedPreTrancheBufferUSDC);
      console.log("PreTrancheBuffer seeded");
    }
    if (p.bootstrap?.seedTreasuryUSDC !== "0") {
      await (await usdc.approve(await tre.getAddress(), p.bootstrap.seedTreasuryUSDC)).wait();
      await tre.deposit(p.bootstrap.seedTreasuryUSDC);
      console.log("Treasury seeded");
    }

    // Lock issuance default
    if (p.bootstrap?.lockIssuanceByDefault) {
      await tm.connect(await ethers.getSigner(p.addresses.GOV_SAFE)).setIssuanceLocked(true);
      console.log("Issuance locked by default");
    }

    // Save addresses + manifest
    fs.mkdirSync(`deployment`, { recursive: true });
    const addresses = {
      ConfigRegistry: await cfg.getAddress(),
      MemberRegistry: await mem.getAddress(),
      NAVOracleV3: await nav.getAddress(),
      TrancheManagerV2: await tm.getAddress(),
      Treasury: await tre.getAddress(),
      PreTrancheBuffer: await pre.getAddress(),
      BRICSToken: await tok.getAddress(),
      RedemptionClaim: await cla.getAddress(),
      ClaimRegistry: await reg.getAddress(),
      IssuanceControllerV3: await ic.getAddress()
    };
    fs.writeFileSync(`deployment/${p.network}.addresses.json`, JSON.stringify(addresses, null, 2));
    fs.writeFileSync(`deployment/${p.network}.manifest.json`, JSON.stringify(manifest, null, 2));

    console.log(`Addresses saved to deployment/${p.network}.addresses.json`);
    console.log(`Manifest saved to deployment/${p.network}.manifest.json`);

    // Etherscan verify (best-effort)
    if (hre.network.name !== "hardhat" && process.env.ETHERSCAN_API_KEY) {
      console.log("Verifying contracts on Etherscan...");
      const v = async (name: string, addr: string, args: any[]) => {
        try { 
          await hre.run("verify:verify", { address: addr, constructorArguments: args }); 
          console.log(`✅ ${name} verified`);
        } catch (e) {
          console.log(`⚠️  ${name} verification failed: ${e.message}`);
        }
      };
      await v("ConfigRegistry", addresses.ConfigRegistry, [p.addresses.GOV_SAFE]);
      await v("MemberRegistry", addresses.MemberRegistry, [p.addresses.GOV_SAFE]);
      await v("NAVOracleV3", addresses.NAVOracleV3, [p.addresses.GOV_SAFE, p.oracle.modelHash]);
      await v("TrancheManagerV2", addresses.TrancheManagerV2, [p.addresses.GOV_SAFE, addresses.NAVOracleV3, addresses.ConfigRegistry]);
      await v("Treasury", addresses.Treasury, [p.addresses.GOV_SAFE, p.addresses.USDC, 300]);
      await v("PreTrancheBuffer", addresses.PreTrancheBuffer, [p.addresses.GOV_SAFE, p.addresses.USDC, addresses.MemberRegistry, addresses.ConfigRegistry]);
      await v("BRICSToken", addresses.BRICSToken, [p.addresses.GOV_SAFE, addresses.MemberRegistry]);
      await v("RedemptionClaim", addresses.RedemptionClaim, [p.addresses.GOV_SAFE, addresses.MemberRegistry, addresses.ConfigRegistry]);
      await v("ClaimRegistry", addresses.ClaimRegistry, [p.addresses.GOV_SAFE]);
      await v("IssuanceControllerV3", addresses.IssuanceControllerV3, [
        p.addresses.GOV_SAFE, addresses.BRICSToken, addresses.TrancheManagerV2, addresses.ConfigRegistry,
        addresses.NAVOracleV3, p.addresses.USDC, addresses.Treasury, addresses.RedemptionClaim, addresses.PreTrancheBuffer, addresses.ClaimRegistry
      ]);
    }

    console.log("✅ BRICS core deployment complete!");
  });
