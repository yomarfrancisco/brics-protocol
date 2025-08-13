#!/usr/bin/env ts-node

/**
 * Release Dry-Run
 * 
 * Computes next version, writes notes, and prints tag name.
 * Usage: ts-node scripts/release/dry-run.ts
 * 
 * Does not push or publish anything.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function getNextVersion(): string {
  const envVersion = process.env.NEXT_VERSION;
  if (envVersion) {
    return envVersion;
  }
  
  // Run next-version script
  try {
    const output = execSync('ts-node scripts/release/next-version.ts', { encoding: 'utf8' });
    const match = output.match(/NEXT_VERSION=([^\s]+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    console.error('Could not determine next version:', error);
    process.exit(1);
  }
  
  return '0.1.1'; // Default fallback
}

function checkGitStatus(): void {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.warn('⚠️  Warning: Working directory has uncommitted changes');
      console.warn('   Consider committing or stashing changes before release');
      console.warn('');
    }
  } catch (error) {
    console.warn('Could not check git status:', error);
  }
}

function checkCurrentBranch(): void {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (branch !== 'main' && branch !== 'master') {
      console.warn(`⚠️  Warning: Not on main branch (current: ${branch})`);
      console.warn('   Releases should typically be made from main/master');
      console.warn('');
    }
  } catch (error) {
    console.warn('Could not check current branch:', error);
  }
}

function runReleaseSteps(): void {
  console.log('🚀 Starting release dry-run...\n');
  
  // Step 1: Determine next version
  console.log('1️⃣  Determining next version...');
  const nextVersion = getNextVersion();
  console.log(`   Next version: ${nextVersion}\n`);
  
  // Step 2: Generate changelog
  console.log('2️⃣  Generating changelog...');
  try {
    execSync('ts-node scripts/release/changelog.ts', { stdio: 'inherit' });
    console.log('   ✅ Changelog updated\n');
  } catch (error) {
    console.error('   ❌ Failed to generate changelog:', error);
    process.exit(1);
  }
  
  // Step 3: Generate release notes
  console.log('3️⃣  Generating release notes...');
  try {
    execSync('ts-node scripts/release/notes.ts', { stdio: 'inherit' });
    console.log('   ✅ Release notes generated\n');
  } catch (error) {
    console.error('   ❌ Failed to generate release notes:', error);
    process.exit(1);
  }
  
  // Step 4: Verify artifacts
  console.log('4️⃣  Verifying artifacts...');
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  const notesPath = path.join(process.cwd(), 'dist', 'release-notes.md');
  
  if (!fs.existsSync(changelogPath)) {
    console.error('   ❌ CHANGELOG.md not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(notesPath)) {
    console.error('   ❌ Release notes not found');
    process.exit(1);
  }
  
  console.log('   ✅ All artifacts verified\n');
  
  // Step 5: Print summary
  console.log('📋 Release Summary');
  console.log('==================');
  console.log(`Version: v${nextVersion}`);
  console.log(`Tag: v${nextVersion}`);
  console.log(`Changelog: CHANGELOG.md`);
  console.log(`Release Notes: dist/release-notes.md`);
  console.log('');
  
  // Step 6: Print next steps
  console.log('📝 Next Steps (Manual)');
  console.log('=======================');
  console.log('1. Review CHANGELOG.md and dist/release-notes.md');
  console.log('2. Run tests: yarn test:unit && cd risk_api && pytest -q');
  console.log('3. Create tag: git tag v' + nextVersion);
  console.log('4. Push tag: git push origin v' + nextVersion);
  console.log('5. Create GitHub release using dist/release-notes.md');
  console.log('');
  
  console.log('🎉 Dry-run completed successfully!');
  console.log(`   Tag name: v${nextVersion}`);
}

function main() {
  try {
    // Pre-flight checks
    checkGitStatus();
    checkCurrentBranch();
    
    // Run release steps
    runReleaseSteps();
    
  } catch (error) {
    console.error('❌ Release dry-run failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

