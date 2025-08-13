#!/usr/bin/env ts-node

/**
 * Gas Budget Checker
 * 
 * Reads gas-report.txt and checks against defined budgets.
 * Usage: node scripts/check-gas-budget.ts
 * 
 * Environment variables:
 * - GAS_BUDGET_ENFORCE: if "true", fails on breach; otherwise warns
 */

import * as fs from 'fs';
import * as path from 'path';

interface GasReport {
  [contract: string]: {
    [functionName: string]: {
      gasCost: number;
      executionCost: number;
    };
  };
}

// Gas budgets (in gas units)
const GAS_BUDGETS: Record<string, Record<string, number>> = {
  'InstantLane': {
    'instantRedeem': 200000,
    'instantRedeemFor': 200000,
    'preTradeCheck': 5000,
  },
  'CdsSwapEngine': {
    'settleSwap': 150000,
    'proposeSwap': 100000,
    'activateSwap': 50000,
  },
  'ConfigRegistry': {
    'setTradeFeeBps': 30000,
    'setPmmCurveK_bps': 30000,
    'setPmmTheta_bps': 30000,
    'setMaxBoundBps': 30000,
    'getEconomics': 5000,
  },
  'Treasury': {
    'pay': 50000,
    'fund': 50000,
    'setBufferTargetBps': 30000,
  },
};

function parseGasReport(filePath: string): GasReport | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Gas report not found at ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const report: GasReport = {};
    
    let currentContract = '';
    
    for (const line of lines) {
      // Look for contract headers (lines with | and contract names)
      const contractMatch = line.match(/\|\s*([A-Za-z0-9_]+)\s*\|/);
      if (contractMatch) {
        currentContract = contractMatch[1];
        report[currentContract] = {};
        continue;
      }
      
      // Look for function entries (lines with function names and gas costs)
      const functionMatch = line.match(/\|\s*([a-zA-Z0-9_]+)\s*\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|/);
      if (functionMatch && currentContract) {
        const [, functionName, gasCost, executionCost] = functionMatch;
              if (!report[currentContract]) {
        report[currentContract] = {};
      }
      (report[currentContract] as any)[functionName] = {
        gasCost: parseInt(gasCost),
        executionCost: parseFloat(executionCost)
      };
      }
    }
    
    return report;
  } catch (error) {
    console.error(`Error parsing gas report: ${error}`);
    return null;
  }
}

function checkGasBudget(report: GasReport): { breaches: string[]; warnings: string[] } {
  const breaches: string[] = [];
  const warnings: string[] = [];
  
  for (const [contract, functions] of Object.entries(GAS_BUDGETS)) {
    if (!report[contract]) {
      warnings.push(`Contract ${contract} not found in gas report`);
      continue;
    }
    
    for (const [functionName, budget] of Object.entries(functions)) {
      const actual = (report[contract] as any)[functionName];
      if (!actual) {
        warnings.push(`Function ${contract}.${functionName} not found in gas report`);
        continue;
      }
      
      if (actual.gasCost > budget) {
        const message = `${contract}.${functionName}: ${actual.gasCost} gas (budget: ${budget})`;
        breaches.push(message);
      }
    }
  }
  
  return { breaches, warnings };
}

function main() {
  const gasReportPath = path.join(process.cwd(), 'gas-report.txt');
  const enforce = process.env.GAS_BUDGET_ENFORCE === 'true';
  
  console.log('🔍 Checking gas budgets...\n');
  
  const report = parseGasReport(gasReportPath);
  if (!report) {
    console.log('No gas report found. Run gas tests first:');
    console.log('  yarn gas:bounds');
    console.log('  yarn gas:core');
    process.exit(0);
  }
  
  const { breaches, warnings } = checkGasBudget(report);
  
  // Print warnings
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`  ${warning}`));
    console.log('');
  }
  
  // Print breaches
  if (breaches.length > 0) {
    console.log('🚨 Gas budget breaches:');
    breaches.forEach(breach => console.log(`  ${breach}`));
    console.log('');
    
    if (enforce) {
      console.log('❌ Gas budget enforcement enabled - failing build');
      process.exit(1);
    } else {
      console.log('⚠️  Gas budget enforcement disabled - continuing build');
    }
  } else {
    console.log('✅ All gas budgets within limits');
  }
  
  // Print summary
  console.log('\n📊 Gas Report Summary:');
  for (const [contract, functions] of Object.entries(report)) {
    console.log(`\n${contract}:`);
    for (const [functionName, data] of Object.entries(functions)) {
      const budget = GAS_BUDGETS[contract]?.[functionName];
      const gasData = data as any;
      const status = budget ? (gasData.gasCost <= budget ? '✅' : '❌') : '⚠️';
      console.log(`  ${status} ${functionName}: ${gasData.gasCost} gas${budget ? ` (budget: ${budget})` : ''}`);
    }
  }
}

if (require.main === module) {
  main();
}
