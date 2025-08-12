#!/usr/bin/env ts-node

import fs from "fs";
import path from "path";
import crypto from "crypto";

function verifyFixture(jsonPath: string, shaPath: string): boolean {
  if (!fs.existsSync(jsonPath) || !fs.existsSync(shaPath)) {
    console.error(`❌ Missing file(s): ${jsonPath} or ${shaPath}`);
    return false;
  }

  const jsonData = fs.readFileSync(jsonPath);
  const hash = crypto.createHash("sha256").update(jsonData).digest("hex").trim();
  const expectedHash = fs.readFileSync(shaPath, "utf-8").trim();

  if (hash !== expectedHash) {
    console.error(`❌ Hash mismatch for ${jsonPath}`);
    console.error(`   Expected: ${expectedHash}`);
    console.error(`   Got:      ${hash}`);
    return false;
  }

  console.log(`✅ Verified: ${path.basename(jsonPath)}`);
  return true;
}

const args = process.argv.slice(2);

// Auto-scan mode
if (args.length < 2) {
  console.log("🔍 Auto-scanning pricing-fixtures/ for frozen fixtures...");
  const fixtureDir = path.join(process.cwd(), "pricing-fixtures");
  if (!fs.existsSync(fixtureDir)) {
    console.error(`❌ Directory not found: ${fixtureDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(fixtureDir).filter(f => f.endsWith("-frozen.json"));
  if (files.length === 0) {
    console.error("❌ No frozen fixtures found.");
    process.exit(1);
  }

  let allPassed = true;
  for (const file of files) {
    const jsonPath = path.join(fixtureDir, file);
    const shaPath = jsonPath.replace("-frozen.json", "-frozen.sha256");
    if (!verifyFixture(jsonPath, shaPath)) allPassed = false;
  }
  process.exit(allPassed ? 0 : 2);
}

// Arg mode
const [jsonPath, shaPath] = args;
process.exit(verifyFixture(jsonPath, shaPath) ? 0 : 2);
