#!/usr/bin/env ts-node

/**
 * Next Version Calculator
 * 
 * Reads conventional commit messages since last tag and proposes next version.
 * Usage: ts-node scripts/release/next-version.ts
 * 
 * Outputs NEXT_VERSION environment variable for consumption by other scripts.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Commit {
  hash: string;
  type: string;
  scope?: string;
  message: string;
  breaking: boolean;
}

function getLastTag(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch {
    // No tags found, use initial commit
    return execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  }
}

function getCommitsSinceTag(tag: string): string[] {
  try {
    const output = execSync(`git log ${tag}..HEAD --oneline --no-merges`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch {
    return [];
  }
}

function parseConventionalCommit(line: string): Commit | null {
  // Extract hash and message
  const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
  if (!match) return null;
  
  const [, hash, message] = match;
  
  // Parse conventional commit format: type(scope): description
  const conventionalMatch = message.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!conventionalMatch) return null;
  
  const [, type, scope, breaking, description] = conventionalMatch;
  
  return {
    hash,
    type: type.toLowerCase(),
    scope,
    message: description,
    breaking: !!breaking || description.toLowerCase().includes('breaking change')
  };
}

function determineVersionBump(commits: Commit[]): 'patch' | 'minor' | 'major' {
  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;
  
  for (const commit of commits) {
    if (commit.breaking) {
      hasBreaking = true;
    } else if (commit.type === 'feat') {
      hasFeature = true;
    } else if (commit.type === 'fix') {
      hasFix = true;
    }
  }
  
  if (hasBreaking) return 'major';
  if (hasFeature) return 'minor';
  if (hasFix) return 'patch';
  
  // Default to patch for other changes (chore, docs, test, ci, etc.)
  return 'patch';
}

function getCurrentVersion(): string {
  try {
    // Try to get version from package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '0.1.0';
    }
  } catch (error) {
    console.warn('Could not read package.json version:', error);
  }
  
  // Fallback: try to get from git tags
  try {
    const lastTag = getLastTag();
    if (lastTag.startsWith('v')) {
      return lastTag.substring(1);
    }
    return lastTag;
  } catch {
    return '0.1.0';
  }
}

function bumpVersion(currentVersion: string, bumpType: 'patch' | 'minor' | 'major'): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
}

function main() {
  try {
    const lastTag = getLastTag();
    const commits = getCommitsSinceTag(lastTag);
    
    if (commits.length === 0) {
      console.log('No commits since last tag, no version bump needed');
      process.exit(0);
    }
    
    const parsedCommits = commits
      .map(parseConventionalCommit)
      .filter((commit): commit is Commit => commit !== null);
    
    if (parsedCommits.length === 0) {
      console.log('No conventional commits found, defaulting to patch');
      const currentVersion = getCurrentVersion();
      const nextVersion = bumpVersion(currentVersion, 'patch');
      console.log(`NEXT_VERSION=${nextVersion}`);
      return;
    }
    
    const bumpType = determineVersionBump(parsedCommits);
    const currentVersion = getCurrentVersion();
    const nextVersion = bumpVersion(currentVersion, bumpType);
    
    console.log(`NEXT_VERSION=${nextVersion}`);
    console.log(`# Version bump: ${bumpType} (${currentVersion} → ${nextVersion})`);
    console.log(`# Commits since ${lastTag}: ${parsedCommits.length}`);
    console.log(`# Breaking changes: ${parsedCommits.filter(c => c.breaking).length}`);
    console.log(`# Features: ${parsedCommits.filter(c => c.type === 'feat').length}`);
    console.log(`# Fixes: ${parsedCommits.filter(c => c.type === 'fix').length}`);
    
  } catch (error) {
    console.error('Error determining next version:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

