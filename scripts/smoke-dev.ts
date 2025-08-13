#!/usr/bin/env ts-node

/**
 * Dev Bootstrap Mini-E2E Smoke Test
 * 
 * Spins up the dev stack and runs one happy path test
 * Usage: ts-node scripts/smoke-dev.ts
 */

import { ethers } from "hardhat";
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  console.log("🧪 Running dev bootstrap mini-e2e smoke test...");
  
  const startTime = Date.now();
  let success = true;
  const errors: string[] = [];

  try {
    // 1. Deploy mocks via hardhat dev:bootstrap
    console.log("📦 Deploying mocks...");
    const { execSync } = require('child_process');
    execSync('yarn hardhat dev:bootstrap', { stdio: 'inherit' });
    console.log("✅ Mocks deployed successfully");

    // 2. Get deployed contracts
    const [deployer] = await ethers.getSigners();
    
    // Get InstantLane (should be deployed by bootstrap)
    const InstantLane = await ethers.getContractFactory("InstantLane");
    const instantLane = await InstantLane.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3"); // Default address

    // 3. Call preTradeCheck() once; expect ok=true at L0 for mid-band price
    console.log("🔍 Testing preTradeCheck...");
    const midBandPrice = 10000; // 100.00 (mid-band for L0 bounds [9800..10200])
    
    try {
      const preTradeResult = await instantLane.preTradeCheck(midBandPrice);
      if (preTradeResult === true) {
        console.log("✅ preTradeCheck passed for mid-band price");
      } else {
        errors.push(`preTradeCheck returned ${preTradeResult}, expected true`);
        success = false;
      }
    } catch (error) {
      errors.push(`preTradeCheck failed: ${error}`);
      success = false;
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

      const navResult = await new Promise<string>((resolve, reject) => {
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
        console.log("✅ NAV sanity check passed");
      } else {
        errors.push(`NAV sanity check failed: ${navResult}`);
        success = false;
      }
    } catch (error) {
      errors.push(`NAV sanity check error: ${error}`);
      success = false;
    }

  } catch (error) {
    errors.push(`Smoke test error: ${error}`);
    success = false;
  }

  const duration = Date.now() - startTime;
  
  console.log("\n📊 Smoke Test Results:");
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`✅ Success: ${success}`);
  
  if (errors.length > 0) {
    console.log("\n❌ Errors:");
    errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (duration > 60000) {
    console.log(`⚠️  Warning: Smoke test took ${duration}ms (>60s target)`);
  }
  
  if (!success) {
    process.exit(1);
  }
  
  console.log("\n🎉 Smoke test completed successfully!");
}

main().catch(console.error);
