#!/usr/bin/env ts-node

/**
 * Validate CI environment variables locally
 * 
 * This script checks for common issues with CI environment variables
 * without exposing sensitive values. Run this locally before pushing
 * to catch issues early.
 */

function validateEnvVar(name: string, value: string | undefined): boolean {
  if (!value) {
    console.log(`❌ ${name}: not set`);
    return false;
  }

  const trimmed = value.trim();
  
  // Check for redacted values
  if (trimmed === "[REDACTED]" || trimmed === "***" || trimmed === "****") {
    console.log(`❌ ${name}: appears to be redacted`);
    return false;
  }

  // Check for placeholder values
  if (trimmed === "placeholder" || trimmed === "secret" || trimmed === "key") {
    console.log(`❌ ${name}: appears to be a placeholder`);
    return false;
  }

  // Check for empty strings
  if (trimmed === "") {
    console.log(`❌ ${name}: empty string`);
    return false;
  }

  // For private keys, validate hex format
  if (name.includes("PRIVKEY") || name.includes("SECRET")) {
    if (!trimmed.startsWith("0x") || trimmed.length !== 66) {
      console.log(`❌ ${name}: invalid hex format (should be 0x + 64 hex chars)`);
      return false;
    }
    
    // Check if it's the fallback key (should warn but not fail)
    if (trimmed === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") {
      console.log(`⚠️  ${name}: using fallback dev key (this is OK for local dev)`);
    }
  }

  console.log(`✅ ${name}: valid`);
  return true;
}

function main() {
  console.log("🔍 Validating CI environment variables...\n");

  const envVars = [
    "CI_SIGNER_PRIVKEY",
    "GITHUB_TOKEN",
    "NPM_TOKEN",
  ];

  let allValid = true;

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (!validateEnvVar(envVar, value)) {
      allValid = false;
    }
  }

  console.log("\n" + "=".repeat(50));
  
  if (allValid) {
    console.log("✅ All environment variables are valid");
    process.exit(0);
  } else {
    console.log("❌ Some environment variables have issues");
    console.log("💡 Fix the issues above before pushing to CI");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
