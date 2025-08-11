import { task } from "hardhat/config";
import fs from "fs";

const load = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

interface RoleCheck {
  check: string;
  ok: boolean;
  details: string;
}

interface AuditResult {
  network: string;
  contracts: Record<string, string>;
  checks: RoleCheck[];
}

task("roles:audit", "Audit role wiring")
  .addParam("addresses", "Path to addresses JSON")
  .addOptionalParam("params", "Path to params JSON")
  .setAction(async ({ addresses, params }, hre) => {
    const A = load(addresses);
    const P = params ? load(params) : null;
    const { ethers } = hre;

    console.log("Auditing role permissions...");

    const result: AuditResult = {
      network: hre.network.name,
      contracts: A,
      checks: []
    };

    // Get contract instances
    const token = await ethers.getContractAt("BRICSToken", A.BRICSToken);
    const ic = await ethers.getContractAt("IssuanceControllerV3", A.IssuanceControllerV3);
    const pre = await ethers.getContractAt("PreTrancheBuffer", A.PreTrancheBuffer);
    const tre = await ethers.getContractAt("Treasury", A.Treasury);
    const mem = await ethers.getContractAt("MemberRegistry", A.MemberRegistry);
    const reg = await ethers.getContractAt("ClaimRegistry", A.ClaimRegistry);
    const tm = await ethers.getContractAt("TrancheManagerV2", A.TrancheManagerV2);
    const cfg = await ethers.getContractAt("ConfigRegistry", A.ConfigRegistry);
    const nav = await ethers.getContractAt("NAVOracleV3", A.NAVOracleV3);
    const cla = await ethers.getContractAt("RedemptionClaim", A.RedemptionClaim);

    // BRICS Token checks
    const bricsMinterOk = await token.hasRole(await token.MINTER_ROLE(), A.IssuanceControllerV3);
    result.checks.push({
      check: "IC has MINTER_ROLE on BRICS",
      ok: bricsMinterOk,
      details: bricsMinterOk ? "" : "missing grant"
    });

    const bricsBurnerOk = await token.hasRole(await token.BURNER_ROLE(), A.IssuanceControllerV3);
    result.checks.push({
      check: "IC has BURNER_ROLE on BRICS",
      ok: bricsBurnerOk,
      details: bricsBurnerOk ? "" : "missing grant"
    });

    // IssuanceController checks
    if (P?.addresses?.OPS_SAFE) {
      const icOpsOk = await ic.hasRole(await ic.OPS_ROLE(), P.addresses.OPS_SAFE);
      result.checks.push({
        check: "OPS_SAFE has OPS_ROLE on IC",
        ok: icOpsOk,
        details: icOpsOk ? "" : "missing grant"
      });
    }

    if (P?.addresses?.BURNER_SAFE) {
      const icBurnerOk = await ic.hasRole(await ic.BURNER_ROLE(), P.addresses.BURNER_SAFE);
      result.checks.push({
        check: "BURNER_SAFE has BURNER_ROLE on IC",
        ok: icBurnerOk,
        details: icBurnerOk ? "" : "missing grant"
      });
    }

    // PreTrancheBuffer checks
    const preBufferOk = await pre.hasRole(await pre.BUFFER_MANAGER(), A.IssuanceControllerV3);
    result.checks.push({
      check: "IC has BUFFER_MANAGER on PreTrancheBuffer",
      ok: preBufferOk,
      details: preBufferOk ? "" : "missing grant"
    });

    // Treasury checks
    const trePayOk = await tre.hasRole(await tre.PAY_ROLE(), A.IssuanceControllerV3);
    result.checks.push({
      check: "IC has PAY_ROLE on Treasury",
      ok: trePayOk,
      details: trePayOk ? "" : "missing grant"
    });

    // ClaimRegistry checks
    if (P?.addresses?.ECC_SAFE) {
      const regEccOk = await reg.hasRole(await reg.ECC_ROLE(), P.addresses.ECC_SAFE);
      result.checks.push({
        check: "ECC_SAFE has ECC_ROLE on ClaimRegistry",
        ok: regEccOk,
        details: regEccOk ? "" : "missing grant"
      });
    }

    if (P?.addresses?.OPS_SAFE) {
      const regOpsOk = await reg.hasRole(await reg.OPS_ROLE(), P.addresses.OPS_SAFE);
      result.checks.push({
        check: "OPS_SAFE has OPS_ROLE on ClaimRegistry",
        ok: regOpsOk,
        details: regOpsOk ? "" : "missing grant"
      });
    }

    // TrancheManager checks
    if (P?.addresses?.ECC_SAFE) {
      const tmEccOk = await tm.hasRole(await tm.ECC_ROLE(), P.addresses.ECC_SAFE);
      result.checks.push({
        check: "ECC_SAFE has ECC_ROLE on TrancheManager",
        ok: tmEccOk,
        details: tmEccOk ? "" : "missing grant"
      });
    }

    // MemberRegistry checks
    if (P?.addresses?.NASASA_ENTITY) {
      const registrar = await mem.registrar();
      const memRegOk = registrar === P.addresses.NASASA_ENTITY;
      result.checks.push({
        check: "NASASA_ENTITY is registrar on MemberRegistry",
        ok: memRegOk,
        details: memRegOk ? "" : `expected ${P.addresses.NASASA_ENTITY}, got ${registrar}`
      });
    }

    // RedemptionClaim checks
    const claIssuerOk = await cla.hasRole(await cla.ISSUER_ROLE(), A.IssuanceControllerV3);
    result.checks.push({
      check: "IC has ISSUER_ROLE on RedemptionClaim",
      ok: claIssuerOk,
      details: claIssuerOk ? "" : "missing grant"
    });

    if (P?.addresses?.BURNER_SAFE) {
      const claBurnerOk = await cla.hasRole(await cla.BURNER_ROLE(), P.addresses.BURNER_SAFE);
      result.checks.push({
        check: "BURNER_SAFE has BURNER_ROLE on RedemptionClaim",
        ok: claBurnerOk,
        details: claBurnerOk ? "" : "missing grant"
      });
    }

    // Output results
    console.log("\nRole Audit Results:");
    console.log("===================");

    let allOk = true;
    for (const check of result.checks) {
      const status = check.ok ? "✅" : "❌";
      console.log(`${status} ${check.check}`);
      if (!check.ok) {
        console.log(`   Details: ${check.details}`);
        allOk = false;
      }
    }

    // Save audit results
    fs.mkdirSync('audit', { recursive: true });
    fs.writeFileSync('audit/roles-audit.json', JSON.stringify(result, null, 2));

    console.log(`\n📄 Audit results saved to audit/roles-audit.json`);

    if (!allOk) {
      console.log("\n❌ Role audit failed! Some roles are not properly configured.");
      process.exit(1);
    } else {
      console.log("\n✅ All roles properly configured!");
    }
  });
