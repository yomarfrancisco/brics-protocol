#!/usr/bin/env ts-node

/**
 * Gas Trend Data Collection
 * 
 * Runs gas tests and appends results to CSV for trend analysis
 * Usage: ts-node scripts/gas/run-and-append.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface GasData {
  date: string;
  sha: string;
  suite: string;
  function: string;
  gas: number;
}

const GAS_CSV_PATH = path.join(process.cwd(), 'dist', 'gas', 'gas-trend.csv');
const GAS_REPORT_PATH = path.join(process.cwd(), 'gas-report.txt');

function ensureGasDir(): void {
  const gasDir = path.dirname(GAS_CSV_PATH);
  if (!fs.existsSync(gasDir)) {
    fs.mkdirSync(gasDir, { recursive: true });
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function parseGasReport(): GasData[] {
  if (!fs.existsSync(GAS_REPORT_PATH)) {
    console.error("❌ Gas report not found:", GAS_REPORT_PATH);
    return [];
  }
  
  const report = fs.readFileSync(GAS_REPORT_PATH, 'utf8');
  const lines = report.split('\n');
  const gasData: GasData[] = [];
  const date = new Date().toISOString().split('T')[0];
  const sha = getGitSha();
  
  let currentSuite = 'unknown';
  
  for (const line of lines) {
    // Detect suite changes
    if (line.includes('ConfigRegistry') || line.includes('InstantLane')) {
      currentSuite = line.split('·')[0].trim();
    }
    
    // Parse gas data lines (format: Contract · Method · Min · Max · Avg · # calls · usd)
    const parts = line.split('·').map(p => p.trim());
    if (parts.length >= 5 && parts[0] && parts[1] && !isNaN(parseInt(parts[4]))) {
      const avgGas = parseInt(parts[4]);
      if (avgGas > 0) {
        gasData.push({
          date,
          sha,
          suite: currentSuite,
          function: `${parts[0]}.${parts[1]}`,
          gas: avgGas
        });
      }
    }
  }
  
  return gasData;
}

function appendToCSV(data: GasData[]): void {
  const csvHeader = 'date,sha,suite,function,gas\n';
  const csvExists = fs.existsSync(GAS_CSV_PATH);
  
  if (!csvExists) {
    fs.writeFileSync(GAS_CSV_PATH, csvHeader);
  }
  
  for (const row of data) {
    const csvLine = `${row.date},${row.sha},${row.suite},${row.function},${row.gas}\n`;
    fs.appendFileSync(GAS_CSV_PATH, csvLine);
  }
  
  console.log(`📊 Appended ${data.length} gas measurements to ${GAS_CSV_PATH}`);
}

function main(): void {
  console.log("🔍 Running gas tests and collecting trend data...");
  
  ensureGasDir();
  
  // Run gas tests
  try {
    console.log("🧪 Running gas tests...");
    execSync('GAS_REPORT=true yarn hardhat test test/fast/economics/config.spec.ts test/fast/amm/instant-bounds-levels.spec.ts', {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error("❌ Gas tests failed:", error);
    process.exit(1);
  }
  
  // Parse and append data
  const gasData = parseGasReport();
  if (gasData.length > 0) {
    appendToCSV(gasData);
    console.log("✅ Gas trend data collected successfully");
  } else {
    console.warn("⚠️  No gas data found in report");
  }
}

main();
