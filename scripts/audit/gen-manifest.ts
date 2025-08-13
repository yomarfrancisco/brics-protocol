#!/usr/bin/env ts-node

/**
 * Build Manifest Generator
 * 
 * Collects and writes build information to dist/audit/manifest.json
 * Usage: ts-node scripts/audit/gen-manifest.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface BuildManifest {
  timestamp: string;
  git: {
    commit: string;
    branch: string;
    lastTag?: string;
    dirty: boolean;
  };
  environment: {
    node: string;
    yarn: string;
    hardhat: string;
    solc: string;
    network: string;
  };
  contracts: ContractInfo[];
  files: {
    yarnLock: string;
    hardhatConfig: string;
    contracts: string;
  };
}

interface ContractInfo {
  name: string;
  bytecodeHash: string;
  abiHash: string;
  storageLayout?: string;
  compilerSettings: {
    optimizerRuns: number;
    evmVersion: string;
    viaIR?: boolean;
  };
}

function getGitInfo(): { commit: string; branch: string; lastTag?: string; dirty: boolean } {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    let lastTag: string | undefined;
    try {
      lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    } catch {
      // No tags found
    }
    
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    const dirty = status.length > 0;
    
    return { commit, branch, lastTag, dirty };
  } catch (error) {
    console.error('Error getting git info:', error);
    return { commit: 'unknown', branch: 'unknown', dirty: false };
  }
}

function getEnvironmentInfo(): { node: string; yarn: string; hardhat: string; solc: string; network: string } {
  try {
    const node = execSync('node --version', { encoding: 'utf8' }).trim();
    const yarn = execSync('yarn --version', { encoding: 'utf8' }).trim();
    const hardhat = execSync('yarn hardhat --version', { encoding: 'utf8' }).trim();
    
    // Get solc version from hardhat config or artifacts
    let solc = 'unknown';
    try {
      const artifactsDir = path.join(process.cwd(), 'artifacts');
      if (fs.existsSync(artifactsDir)) {
        const files = fs.readdirSync(artifactsDir);
        for (const file of files) {
          if (file.endsWith('.json') && !file.includes('dbg')) {
            const artifactPath = path.join(artifactsDir, file);
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            if (artifact.metadata && artifact.metadata.compiler) {
              solc = artifact.metadata.compiler.version;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not determine solc version:', error);
    }
    
    // Get network from hardhat config or default
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    
    return { node, yarn, hardhat, solc, network };
  } catch (error) {
    console.error('Error getting environment info:', error);
    return { node: 'unknown', yarn: 'unknown', hardhat: 'unknown', solc: 'unknown', network: 'unknown' };
  }
}

function getContractInfo(): ContractInfo[] {
  const contracts: ContractInfo[] = [];
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  
  if (!fs.existsSync(artifactsDir)) {
    console.warn('Artifacts directory not found, skipping contract info');
    return contracts;
  }
  
  try {
    const files = fs.readdirSync(artifactsDir);
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('dbg')) {
        const artifactPath = path.join(artifactsDir, file);
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        
        if (artifact.bytecode && artifact.abi) {
          const name = path.basename(file, '.json');
          const bytecodeHash = createHash('keccak256').update(artifact.bytecode.object).digest('hex');
          const abiHash = createHash('keccak256').update(JSON.stringify(artifact.abi)).digest('hex');
          
          let storageLayout: string | undefined;
          if (artifact.storageLayout) {
            storageLayout = createHash('keccak256').update(JSON.stringify(artifact.storageLayout)).digest('hex');
          }
          
          const compilerSettings = {
            optimizerRuns: artifact.metadata?.settings?.optimizer?.runs || 200,
            evmVersion: artifact.metadata?.settings?.evmVersion || 'paris',
            viaIR: artifact.metadata?.settings?.viaIR || false
          };
          
          contracts.push({
            name,
            bytecodeHash,
            abiHash,
            storageLayout,
            compilerSettings
          });
        }
      }
    }
  } catch (error) {
    console.error('Error getting contract info:', error);
  }
  
  return contracts;
}

function getFileHashes(): { yarnLock: string; hardhatConfig: string; contracts: string } {
  try {
    const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
    const hardhatConfigPath = path.join(process.cwd(), 'hardhat.config.ts');
    const contractsDir = path.join(process.cwd(), 'contracts');
    
    const yarnLock = fs.existsSync(yarnLockPath) 
      ? createHash('sha256').update(fs.readFileSync(yarnLockPath)).digest('hex')
      : 'not-found';
    
    const hardhatConfig = fs.existsSync(hardhatConfigPath)
      ? createHash('sha256').update(fs.readFileSync(hardhatConfigPath)).digest('hex')
      : 'not-found';
    
    let contractsHash = 'not-found';
    if (fs.existsSync(contractsDir)) {
      const contractsHashBuilder = createHash('sha256');
      const walkDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (file.endsWith('.sol')) {
            contractsHashBuilder.update(fs.readFileSync(filePath));
          }
        }
      };
      walkDir(contractsDir);
      contractsHash = contractsHashBuilder.digest('hex');
    }
    
    return { yarnLock, hardhatConfig, contracts: contractsHash };
  } catch (error) {
    console.error('Error getting file hashes:', error);
    return { yarnLock: 'error', hardhatConfig: 'error', contracts: 'error' };
  }
}

function generateManifest(): BuildManifest {
  const git = getGitInfo();
  const environment = getEnvironmentInfo();
  const contracts = getContractInfo();
  const files = getFileHashes();
  
  return {
    timestamp: new Date().toISOString(),
    git,
    environment,
    contracts,
    files
  };
}

function writeManifest(manifest: BuildManifest): void {
  const distDir = path.join(process.cwd(), 'dist', 'audit');
  const manifestPath = path.join(distDir, 'manifest.json');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Generated build manifest: ${manifestPath}`);
}

function main() {
  try {
    console.log('Generating build manifest...');
    const manifest = generateManifest();
    writeManifest(manifest);
    
    console.log(`# Build manifest generated`);
    console.log(`# Git commit: ${manifest.git.commit.substring(0, 8)}`);
    console.log(`# Branch: ${manifest.git.branch}`);
    console.log(`# Contracts: ${manifest.contracts.length}`);
    console.log(`# Dirty: ${manifest.git.dirty}`);
    
  } catch (error) {
    console.error('Error generating build manifest:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

