#!/usr/bin/env ts-node

/**
 * Fixtures Index Generator
 * 
 * Scans pricing-fixtures and generates index with hashes
 * Usage: ts-node scripts/audit/fixtures-index.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface FixturesIndex {
  timestamp: string;
  fixtures: FixtureInfo[];
  fixturesHash: string;
  gasReport?: string;
  gasSummary?: GasSummary[];
}

interface FixtureInfo {
  file: string;
  sha256: string;
  size: number;
}

interface GasSummary {
  contract: string;
  function: string;
  avgGas: number;
  maxGas: number;
  calls: number;
}

function scanFixtures(): FixtureInfo[] {
  const fixtures: FixtureInfo[] = [];
  const fixturesDir = path.join(process.cwd(), 'pricing-fixtures');
  
  if (!fs.existsSync(fixturesDir)) {
    console.warn('Pricing fixtures directory not found');
    return fixtures;
  }
  
  try {
    const files = fs.readdirSync(fixturesDir);
    
    for (const file of files) {
      if (file.endsWith('-frozen.json')) {
        const filePath = path.join(fixturesDir, file);
        const sha256Path = path.join(fixturesDir, file.replace('.json', '.sha256'));
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const size = content.length;
          
          // Get SHA256 from companion file or compute it
          let sha256: string;
          if (fs.existsSync(sha256Path)) {
            sha256 = fs.readFileSync(sha256Path, 'utf8').trim();
          } else {
            sha256 = createHash('sha256').update(content).digest('hex');
          }
          
          fixtures.push({
            file,
            sha256,
            size
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning fixtures:', error);
  }
  
  return fixtures;
}

function computeFixturesHash(fixtures: FixtureInfo[]): string {
  const hashBuilder = createHash('sha256');
  
  // Sort fixtures by filename for deterministic hash
  const sortedFixtures = fixtures.sort((a, b) => a.file.localeCompare(b.file));
  
  for (const fixture of sortedFixtures) {
    hashBuilder.update(fixture.file);
    hashBuilder.update(fixture.sha256);
  }
  
  return hashBuilder.digest('hex');
}

function parseGasReport(): GasSummary[] {
  const gasReportPath = path.join(process.cwd(), 'gas-report.txt');
  
  if (!fs.existsSync(gasReportPath)) {
    console.warn('Gas report not found');
    return [];
  }
  
  try {
    const content = fs.readFileSync(gasReportPath, 'utf8');
    const lines = content.split('\n');
    const gasSummary: GasSummary[] = [];
    
    let currentContract = '';
    
    for (const line of lines) {
      // Contract header
      const contractMatch = line.match(/^([A-Za-z0-9_]+)\s*$/);
      if (contractMatch) {
        currentContract = contractMatch[1];
        continue;
      }
      
      // Function line with gas info
      const functionMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (functionMatch && currentContract) {
        const [, funcName, calls, avgGas, maxGas] = functionMatch;
        
        gasSummary.push({
          contract: currentContract,
          function: funcName,
          avgGas: parseInt(avgGas),
          maxGas: parseInt(maxGas),
          calls: parseInt(calls)
        });
      }
    }
    
    return gasSummary;
  } catch (error) {
    console.error('Error parsing gas report:', error);
    return [];
  }
}

function generateGasSummaryCSV(gasSummary: GasSummary[]): void {
  const distDir = path.join(process.cwd(), 'dist', 'audit');
  const csvPath = path.join(distDir, 'gas-summary.csv');
  
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  const csvLines = ['Contract,Function,AvgGas,MaxGas,Calls'];
  
  for (const item of gasSummary) {
    csvLines.push(`${item.contract},${item.function},${item.avgGas},${item.maxGas},${item.calls}`);
  }
  
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`Generated gas summary CSV: ${csvPath}`);
}

function generateFixturesIndex(): FixturesIndex {
  const fixtures = scanFixtures();
  const fixturesHash = computeFixturesHash(fixtures);
  const gasSummary = parseGasReport();
  
  const index: FixturesIndex = {
    timestamp: new Date().toISOString(),
    fixtures,
    fixturesHash,
    gasSummary: gasSummary.length > 0 ? gasSummary : undefined
  };
  
  return index;
}

function writeFixturesIndex(index: FixturesIndex): void {
  const distDir = path.join(process.cwd(), 'dist', 'audit');
  const indexPath = path.join(distDir, 'fixtures.json');
  const hashPath = path.join(distDir, 'fixtures.sha256');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Write fixtures index
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Generated fixtures index: ${indexPath}`);
  
  // Write fixtures hash
  fs.writeFileSync(hashPath, index.fixturesHash);
  console.log(`Generated fixtures hash: ${hashPath}`);
  
  // Generate gas summary CSV if available
  if (index.gasSummary) {
    generateGasSummaryCSV(index.gasSummary);
  }
}

function main() {
  try {
    console.log('Generating fixtures index...');
    const index = generateFixturesIndex();
    writeFixturesIndex(index);
    
    console.log(`# Fixtures index generated`);
    console.log(`# Fixtures found: ${index.fixtures.length}`);
    console.log(`# Fixtures hash: ${index.fixturesHash.substring(0, 8)}...`);
    console.log(`# Gas functions: ${index.gasSummary?.length || 0}`);
    
  } catch (error) {
    console.error('Error generating fixtures index:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

