import { task } from "hardhat/config";
import fs from "fs";

task("roles:wire", "Grant/verify roles per params")
  .addParam("params", "Path to params json")
  .addParam("addresses", "Path to addresses json")
  .setAction(async ({ params, addresses }, hre) => {
    const p = JSON.parse(fs.readFileSync(params, "utf8"));
    const a = JSON.parse(fs.readFileSync(addresses, "utf8"));
    const gov = await hre.ethers.getSigner(p.gov);

    console.log("Wiring roles...");

    const brics = await hre.ethers.getContractAt("BRICSToken", a.brics, gov);
    const pre = await hre.ethers.getContractAt("PreTrancheBuffer", a.pre, gov);
    const claims = await hre.ethers.getContractAt("RedemptionClaim", a.claims, gov);
    const ic = await hre.ethers.getContractAt("IssuanceControllerV3", a.issuance, gov);
    const member = await hre.ethers.getContractAt("MemberRegistry", a.member, gov);
    const config = await hre.ethers.getContractAt("ConfigRegistry", a.config, gov);
    const tranche = await hre.ethers.getContractAt("TrancheManagerV2", a.tranche, gov);
    const creg = await hre.ethers.getContractAt("ClaimRegistry", a.claimRegistry, gov);
    const treasury = await hre.ethers.getContractAt("Treasury", a.treasury, gov);

    // Grants
    console.log("Granting roles...");
    
    await brics.grantRole(await brics.MINTER_ROLE(), a.issuance);
    console.log("BRICS MINTER_ROLE → issuance");

    await brics.grantRole(await brics.BURNER_ROLE(), a.issuance);
    console.log("BRICS BURNER_ROLE → issuance");

    await claims.grantRole(await claims.ISSUER_ROLE(), a.issuance);
    console.log("RedemptionClaim ISSUER_ROLE → issuance");

    await claims.grantRole(await claims.BURNER_ROLE(), p.burner);
    console.log("RedemptionClaim BURNER_ROLE → burner");

    await ic.grantRole(await ic.OPS_ROLE(), p.ops);
    console.log("IssuanceController OPS_ROLE → ops");

    await ic.grantRole(await ic.BURNER_ROLE(), p.burner);
    console.log("IssuanceController BURNER_ROLE → burner");

    await pre.grantRole(await pre.BUFFER_MANAGER(), a.issuance);
    console.log("PreTrancheBuffer BUFFER_MANAGER → issuance");

    await treasury.grantRole(await treasury.PAY_ROLE(), a.issuance);
    console.log("Treasury PAY_ROLE → issuance");

    await creg.grantRole(await creg.ECC_ROLE(), p.ecc);
    console.log("ClaimRegistry ECC_ROLE → ecc");

    await tranche.grantRole(await tranche.ECC_ROLE(), p.ecc);
    console.log("TrancheManager ECC_ROLE → ecc");

    await member.setRegistrar(p.nasasa);
    console.log("MemberRegistry registrar → nasasa");

    // Post-wiring invariants (throw if off)
    console.log("Verifying role grants...");
    
    const hasOps = await ic.hasRole(await ic.OPS_ROLE(), p.ops);
    if (!hasOps) throw new Error("OPS_ROLE not wired");

    const hasBurner = await ic.hasRole(await ic.BURNER_ROLE(), p.burner);
    if (!hasBurner) throw new Error("BURNER_ROLE not wired");

    const hasMinter = await brics.hasRole(await brics.MINTER_ROLE(), a.issuance);
    if (!hasMinter) throw new Error("MINTER_ROLE not wired");

    console.log("✅ All roles wired successfully!");
  });
