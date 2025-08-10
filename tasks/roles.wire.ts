import { task } from "hardhat/config";
import fs from "fs";

const load = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

task("roles:wire", "Assign production roles")
  .addParam("params", "Path to params JSON")
  .addParam("addresses", "Path to addresses JSON")
  .setAction(async ({ params, addresses }, hre) => {
    const P = load(params);
    const A = load(addresses);
    const { ethers } = hre;

    const gov = await ethers.getSigner(P.addresses.GOV_SAFE);
    const ops = P.addresses.OPS_SAFE;
    const ecc = P.addresses.ECC_SAFE;
    const burner = P.addresses.BURNER_SAFE;
    const nasasa = P.addresses.NASASA_ENTITY;

    console.log("Wiring production roles...");

    const token = await ethers.getContractAt("BRICSToken", A.BRICSToken);
    const ic = await ethers.getContractAt("IssuanceControllerV3", A.IssuanceControllerV3);
    const pre = await ethers.getContractAt("PreTrancheBuffer", A.PreTrancheBuffer);
    const tre = await ethers.getContractAt("Treasury", A.Treasury);
    const mem = await ethers.getContractAt("MemberRegistry", A.MemberRegistry);
    const reg = await ethers.getContractAt("ClaimRegistry", A.ClaimRegistry);
    const tm  = await ethers.getContractAt("TrancheManagerV2", A.TrancheManagerV2);

    // Roles
    console.log("Granting roles...");
    
    await token.connect(gov).grantRole(await token.MINTER_ROLE(), A.IssuanceControllerV3);
    console.log("BRICS MINTER_ROLE → issuance");

    await token.connect(gov).grantRole(await token.BURNER_ROLE(), A.IssuanceControllerV3);
    console.log("BRICS BURNER_ROLE → issuance");

    await ic.connect(gov).grantRole(await ic.OPS_ROLE(), ops);
    console.log("IssuanceController OPS_ROLE → ops");

    await ic.connect(gov).grantRole(await ic.BURNER_ROLE(), burner);
    console.log("IssuanceController BURNER_ROLE → burner");

    await pre.connect(gov).grantRole(await pre.BUFFER_MANAGER(), A.IssuanceControllerV3);
    console.log("PreTrancheBuffer BUFFER_MANAGER → issuance");

    await tre.connect(gov).grantRole(await tre.PAY_ROLE(), A.IssuanceControllerV3);
    console.log("Treasury PAY_ROLE → issuance");

    await reg.connect(gov).grantRole(await reg.ECC_ROLE(), ecc);
    console.log("ClaimRegistry ECC_ROLE → ecc");

    await reg.connect(gov).grantRole(await reg.OPS_ROLE(), ops);
    console.log("ClaimRegistry OPS_ROLE → ops");

    await tm.connect(gov).grantRole(await tm.ECC_ROLE(), ecc);
    console.log("TrancheManager ECC_ROLE → ecc");

    // Registrar/NASASA
    await mem.connect(gov).setRegistrar(nasasa);
    console.log("MemberRegistry registrar → nasasa");

    console.log("✅ All production roles wired successfully!");
  });
