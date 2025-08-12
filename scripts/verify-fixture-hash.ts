// scripts/verify-fixture-hash.ts
import { readFileSync } from "fs";
import crypto from "crypto";
import { argv } from "process";

if (argv.length < 4) {
  console.error("Usage: ts-node scripts/verify-fixture-hash.ts <jsonPath> <shaPath>");
  process.exit(2);
}

const [ , , jsonPath, shaPath ] = argv;
const json = readFileSync(jsonPath);
const expected = readFileSync(shaPath, "utf8").trim();
const actual = crypto.createHash("sha256").update(json).digest("hex");

if (actual !== expected) {
  console.error(`Hash mismatch:\n expected: ${expected}\n   actual: ${actual}`);
  process.exit(1);
}
console.log(`OK: ${jsonPath} sha256 matches ${expected}`);
