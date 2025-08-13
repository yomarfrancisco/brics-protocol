#!/usr/bin/env ts-node

/**
 * Dev Bootstrap Mini-E2E Smoke Test
 * 
 * Spins up the dev stack and runs one happy path test
 * Usage: ts-node scripts/smoke-dev.ts
 */

import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

interface SmokeResult {
  success: boolean;
  duration: number;
  checks: {
    deployment: boolean;
    preTradeCheck: boolean;
    navSanity: boolean;
  };
  errors: string[];
}

async function runSmokeTest(): Promise<SmokeResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const checks = {
    deployment: false,
    preTradeCheck: false,
    navSanity: false
  };

  try {
    console.log("🚀 Starting dev bootstrap smoke test...");

    // 1. Deploy mocks via hardhat dev:bootstrap
    console.log("📦 Deploying mocks...");
    const { execSync } = require('child_process');
    execSync('yarn hardhat dev:bootstrap', { stdio: 'inherit' });
    checks.deployment = true;
    console.log("✅ Mocks deployed successfully");

    // 2. Get deployed contracts
    const [deployer] = await ethers.getSigners();
    
    // Get InstantLane (should be deployed by bootstrap)
    const InstantLane = await ethers.getContractFactory("InstantLane");
    const instantLane = await InstantLane.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3"); // Default address
    
    // Get ConfigRegistry
    const ConfigRegistry = await ethers.getContractFactory("ConfigRegistry");
    const configRegistry = await ConfigRegistry.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"); // Default address

    // 3. Call preTradeCheck() once; expect ok=true at L0 for mid-band price
    console.log("🔍 Testing preTradeCheck...");
    const midBandPrice = 10000; // 100.00 (mid-band for L0 bounds [9800..10200])
    
    try {
      const preTradeResult = await instantLane.preTradeCheck(midBandPrice);
      if (preTradeResult === true) {
        checks.preTradeCheck = true;
        console.log("✅ preTradeCheck passed for mid-band price");
      } else {
        errors.push(`preTradeCheck returned ${preTradeResult}, expected true`);
      }
    } catch (error) {
      errors.push(`preTradeCheck failed: ${error}`);
    }

    // 4. Run one mocked NAV sanity request via Risk API (local)
    console.log("🌐 Testing NAV sanity check...");
    try {
      const { spawn } = require('child_process');
      const pythonProcess = spawn('python3', ['-c', `
import sys
sys.path.append('./risk_api')
from providers.safety import NAVSanityProvider
provider = NAVSanityProvider()
result = provider.check_nav_sanity(1000000000000000000000000, 1000000000000000000000000)
print(f"NAV sanity result: {result}")
`], { cwd: process.cwd() });

      const navResult = await new Promise((resolve, reject) => {
        let output = '';
        pythonProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        pythonProcess.stderr.on('data', (data: Buffer) => {
          console.warn(`Python stderr: ${data}`);
        });
        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Python process exited with code ${code}`));
          }
        });
      });

      if (navResult.includes("NAV sanity result: True")) {
        checks.navSanity = true;
        console.log("✅ NAV sanity check passed");
      } else {
        errors.push(`NAV sanity check failed: ${navResult}`);
      }
    } catch (error) {
      errors.push(`NAV sanity check error: ${error}`);
    }

  } catch (error) {
    errors.push(`Smoke test error: ${error}`);
  }

  const duration = Date.now() - startTime;
  const success = checks.deployment && checks.preTradeCheck && checks.navSanity && errors.length === 0;

  return {
    success,
    duration,
    checks,
    errors
  };
}

async function main(): Promise<void> {
  console.log("🧪 Running dev bootstrap mini-e2e smoke test...");
  
  const result = await runSmokeTest();
  
  console.log("\n📊 Smoke Test Results:");
  console.log(`⏱️  Duration: ${result.duration}ms`);
  console.log(`✅ Success: ${result.success}`);
  console.log(`📦 Deployment: ${result.checks.deployment ? '✅' : '❌'}`);
  console.log(`🔍 PreTradeCheck: ${result.checks.preTradeCheck ? '✅' : '❌'}`);
  console.log(`🌐 NAV Sanity: ${result.checks.navSanity ? '✅' : '❌'}`);
  
  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (result.duration > 60000) {
    console.log(`⚠️  Warning: Smoke test took ${result.duration}ms (>60s target)`);
  }
  
  if (!result.success) {
    process.exit(1);
  }
  
  console.log("\n🎉 Smoke test completed successfully!");
}

main().catch(console.error);
