#!/usr/bin/env ts-node

/**
 * Audit Bundle Builder
 * 
 * Creates a signed audit bundle with all artifacts
 * Usage: ts-node scripts/audit/bundle.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import archiver from 'archiver';

interface BundleInfo {
  timestamp: string;
  commit: string;
  bundleHash: string;
  contents: string[];
  size: number;
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Error getting git commit:', error);
    return 'unknown';
  }
}

function collectArtifacts(): string[] {
  const artifacts: string[] = [];
  const baseDir = process.cwd();
  
  // Core audit artifacts
  const auditFiles = [
    'dist/audit/manifest.json',
    'dist/audit/fixtures.json',
    'dist/audit/fixtures.sha256',
    'dist/audit/tests.json',
    'dist/audit/events.json',
    'dist/audit/gas-summary.csv'
  ];
  
  for (const file of auditFiles) {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) {
      artifacts.push(file);
    }
  }
  
  // Gas reports
  const gasFiles = [
    'gas-report.txt',
    'dist/gas/'
  ];
  
  for (const file of gasFiles) {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) {
      artifacts.push(file);
    }
  }
  
  // Release artifacts
  const releaseFiles = [
    'CHANGELOG.md',
    'dist/release-notes.md'
  ];
  
  for (const file of releaseFiles) {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) {
      artifacts.push(file);
    }
  }
  
  // Dev stack addresses
  const devstackPath = path.join(baseDir, '.devstack/addresses.json');
  if (fs.existsSync(devstackPath)) {
    artifacts.push('.devstack/addresses.json');
  }
  
  // Coverage reports
  const coveragePath = path.join(baseDir, 'coverage/');
  if (fs.existsSync(coveragePath)) {
    artifacts.push('coverage/');
  }
  
  return artifacts;
}

function createBundle(artifacts: string[], commit: string): Promise<{ bundlePath: string; size: number }> {
  return new Promise((resolve, reject) => {
    const distDir = path.join(process.cwd(), 'dist', 'audit');
    const bundleName = `audit-bundle-${commit.substring(0, 8)}.zip`;
    const bundlePath = path.join(distDir, bundleName);
    
    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    const output = fs.createWriteStream(bundlePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      const size = archive.pointer();
      resolve({ bundlePath, size });
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add artifacts to bundle
    for (const artifact of artifacts) {
      const fullPath = path.join(process.cwd(), artifact);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          archive.directory(fullPath, artifact);
        } else {
          archive.file(fullPath, { name: artifact });
        }
      }
    }
    
    // Add bundle info
    const bundleInfo: BundleInfo = {
      timestamp: new Date().toISOString(),
      commit,
      bundleHash: '', // Will be set after creation
      contents: artifacts,
      size: 0 // Will be set after creation
    };
    
    archive.append(JSON.stringify(bundleInfo, null, 2), { name: 'bundle-info.json' });
    
    archive.finalize();
  });
}

function computeBundleHash(bundlePath: string): string {
  const content = fs.readFileSync(bundlePath);
  return createHash('sha256').update(content).digest('hex');
}

function writeBundleHash(bundlePath: string, bundleHash: string): void {
  const hashPath = path.join(process.cwd(), 'dist', 'audit', 'audit-bundle.sha256');
  fs.writeFileSync(hashPath, bundleHash);
  console.log(`Generated bundle hash: ${hashPath}`);
}

function main() {
  try {
    console.log('Building audit bundle...');
    
    const commit = getGitCommit();
    const artifacts = collectArtifacts();
    
    if (artifacts.length === 0) {
      console.warn('No artifacts found to bundle');
      return;
    }
    
    console.log(`# Found ${artifacts.length} artifacts to bundle`);
    for (const artifact of artifacts) {
      console.log(`  - ${artifact}`);
    }
    
    createBundle(artifacts, commit)
      .then(({ bundlePath, size }) => {
        const bundleHash = computeBundleHash(bundlePath);
        writeBundleHash(bundlePath, bundleHash);
        
        console.log(`# Audit bundle created: ${bundlePath}`);
        console.log(`# Bundle size: ${(size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`# Bundle hash: ${bundleHash.substring(0, 8)}...`);
        console.log(`# Contents: ${artifacts.length} files/directories`);
      })
      .catch((error) => {
        console.error('Error creating bundle:', error);
        process.exit(1);
      });
    
  } catch (error) {
    console.error('Error building audit bundle:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
