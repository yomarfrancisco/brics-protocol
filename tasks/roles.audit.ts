import { task } from "hardhat/config";
import fs from "fs";

task("roles:audit", "Audit on-chain roles vs matrix")
  .addParam("params", "Path to params json")
  .addParam("addresses", "Path to addresses json")
  .setAction(async ({ params, addresses }, hre) => {
    const p = JSON.parse(fs.readFileSync(params, "utf8"));
    const a = JSON.parse(fs.readFileSync(addresses, "utf8"));
    const gov = await hre.ethers.getSigner(p.gov);

    console.log("Auditing role permissions...");

    const brics = await hre.ethers.getContractAt("BRICSToken", a.brics, gov);
    const pre = await hre.ethers.getContractAt("PreTrancheBuffer", a.pre, gov);
    const claims = await hre.ethers.getContractAt("RedemptionClaim", a.claims, gov);
    const ic = await hre.ethers.getContractAt("IssuanceControllerV3", a.issuance, gov);
    const member = await hre.ethers.getContractAt("MemberRegistry", a.member, gov);
    const config = await hre.ethers.getContractAt("ConfigRegistry", a.config, gov);
    const tranche = await hre.ethers.getContractAt("TrancheManagerV2", a.tranche, gov);
    const creg = await hre.ethers.getContractAt("ClaimRegistry", a.claimRegistry, gov);
    const treasury = await hre.ethers.getContractAt("Treasury", a.treasury, gov);

    const expectedRoles = [
      // BRICS Token
      { contract: "BRICSToken", role: "MINTER_ROLE", expected: a.issuance, actual: await brics.MINTER_ROLE() },
      { contract: "BRICSToken", role: "BURNER_ROLE", expected: a.issuance, actual: await brics.BURNER_ROLE() },
      
      // RedemptionClaim
      { contract: "RedemptionClaim", role: "ISSUER_ROLE", expected: a.issuance, actual: await claims.ISSUER_ROLE() },
      { contract: "RedemptionClaim", role: "BURNER_ROLE", expected: p.burner, actual: await claims.BURNER_ROLE() },
      
      // IssuanceController
      { contract: "IssuanceController", role: "OPS_ROLE", expected: p.ops, actual: await ic.OPS_ROLE() },
      { contract: "IssuanceController", role: "BURNER_ROLE", expected: p.burner, actual: await ic.BURNER_ROLE() },
      
      // PreTrancheBuffer
      { contract: "PreTrancheBuffer", role: "BUFFER_MANAGER", expected: a.issuance, actual: await pre.BUFFER_MANAGER() },
      
      // Treasury
      { contract: "Treasury", role: "PAY_ROLE", expected: a.issuance, actual: await treasury.PAY_ROLE() },
      
      // ClaimRegistry
      { contract: "ClaimRegistry", role: "ECC_ROLE", expected: p.ecc, actual: await creg.ECC_ROLE() },
      
      // TrancheManager
      { contract: "TrancheManager", role: "ECC_ROLE", expected: p.ecc, actual: await tranche.ECC_ROLE() },
    ];

    let hasDrift = false;
    console.log("\nRole Audit Results:");
    console.log("===================");

    for (const role of expectedRoles) {
      const hasRole = await (role.contract === "BRICSToken" ? brics : 
                           role.contract === "RedemptionClaim" ? claims :
                           role.contract === "IssuanceController" ? ic :
                           role.contract === "PreTrancheBuffer" ? pre :
                           role.contract === "Treasury" ? treasury :
                           role.contract === "ClaimRegistry" ? creg :
                           role.contract === "TrancheManager" ? tranche : null)
                           .hasRole(role.actual, role.expected);

      const status = hasRole ? "✅" : "❌";
      console.log(`${status} ${role.contract}.${role.role}: ${role.expected}`);
      
      if (!hasRole) {
        hasDrift = true;
      }
    }

    // Check registrar
    const registrar = await member.registrar();
    const registrarStatus = registrar === p.nasasa ? "✅" : "❌";
    console.log(`${registrarStatus} MemberRegistry.registrar: ${p.nasasa}`);
    if (registrar !== p.nasasa) {
      hasDrift = true;
    }

    if (hasDrift) {
      console.log("\n❌ Role drift detected! Some roles are not properly configured.");
      process.exit(1);
    } else {
      console.log("\n✅ All roles match expected configuration!");
    }
  });
