import { task } from "hardhat/config";
import fs from "fs";

task("deploy:core", "Deploy BRICS core")
  .addParam("params", "Path to params json")
  .setAction(async ({ params }, hre) => {
    const p = JSON.parse(fs.readFileSync(params, "utf8"));
    const [deployer] = await hre.ethers.getSigners();

    const deploy = async (name: string, args: any[] = []) => {
      const F = await hre.ethers.getContractFactory(name);
      const c = await F.deploy(...args);
      await c.waitForDeployment();
      return c;
    };

    console.log("Deploying BRICS core contracts...");

    const member = await deploy("MemberRegistry", [p.gov]);
    console.log("MemberRegistry deployed:", await member.getAddress());

    const config = await deploy("ConfigRegistry", [p.gov]);
    console.log("ConfigRegistry deployed:", await config.getAddress());

    const treasury = await deploy("Treasury", [p.gov, p.usdc, 300]);
    console.log("Treasury deployed:", await treasury.getAddress());

    const pre = await deploy("PreTrancheBuffer", [p.gov, p.usdc, await member.getAddress(), await config.getAddress()]);
    console.log("PreTrancheBuffer deployed:", await pre.getAddress());

    const brics = await deploy("BRICSToken", [p.gov, await member.getAddress()]);
    console.log("BRICSToken deployed:", await brics.getAddress());

    const claims = await deploy("RedemptionClaim", [p.gov, await member.getAddress(), await config.getAddress()]);
    console.log("RedemptionClaim deployed:", await claims.getAddress());

    const oracle = await deploy("NAVOracleV3", [p.gov, ethers.keccak256(ethers.toUtf8Bytes("default-model"))]);
    console.log("NAVOracleV3 deployed:", await oracle.getAddress());

    const tranche = await deploy("TrancheManagerV2", [p.gov, await oracle.getAddress(), await config.getAddress()]);
    console.log("TrancheManagerV2 deployed:", await tranche.getAddress());

    const creg = await deploy("ClaimRegistry", [p.gov]);
    console.log("ClaimRegistry deployed:", await creg.getAddress());

    const ic = await deploy("IssuanceControllerV3", [
      p.gov, 
      await brics.getAddress(), 
      await tranche.getAddress(), 
      await config.getAddress(),
      await oracle.getAddress(), 
      p.usdc, 
      await treasury.getAddress(), 
      await claims.getAddress(),
      await pre.getAddress(), 
      await creg.getAddress()
    ]);
    console.log("IssuanceControllerV3 deployed:", await ic.getAddress());

    // Wire params
    console.log("Configuring contracts...");
    
    await tranche.connect(await hre.ethers.getSigner(p.gov)).adjustSuperSeniorCap(p.superSeniorCap);
    console.log("Super senior cap set");

    for (const s of p.sovereigns) {
      await config.connect(await hre.ethers.getSigner(p.gov)).addSovereign(s.code, s.utilCapBps, s.haircutBps, s.weightBps, s.enabled);
      await ic.connect(await hre.ethers.getSigner(p.gov)).setSovereignCap(s.code, s.softCapTokens, s.hardCapTokens);
      console.log(`Sovereign ${s.code} configured`);
    }

    // Save addresses
    const addresses = {
      member: await member.getAddress(),
      config: await config.getAddress(),
      treasury: await treasury.getAddress(),
      pre: await pre.getAddress(),
      brics: await brics.getAddress(),
      claims: await claims.getAddress(),
      oracle: await oracle.getAddress(),
      tranche: await tranche.getAddress(),
      claimRegistry: await creg.getAddress(),
      issuance: await ic.getAddress()
    };

    const outputPath = `deployment/${hre.network.name}.addresses.json`;
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
    console.log(`Addresses saved to ${outputPath}`);

    console.log("✅ BRICS core deployment complete!");
  });
