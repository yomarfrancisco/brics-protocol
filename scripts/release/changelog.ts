#!/usr/bin/env ts-node

/**
 * Changelog Generator
 * 
 * Generates a section in CHANGELOG.md for the next version with categorized commits.
 * Usage: ts-node scripts/release/changelog.ts
 * 
 * Reads NEXT_VERSION from environment or determines it automatically.
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

function getNextVersion(): string {
  const envVersion = process.env.NEXT_VERSION;
  if (envVersion) {
    return envVersion;
  }
  
  // Fallback: run next-version script
  try {
    const output = execSync('ts-node scripts/release/next-version.ts', { encoding: 'utf8' });
    const match = output.match(/NEXT_VERSION=([^\s]+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    console.warn('Could not determine next version:', error);
  }
  
  return '0.1.1'; // Default fallback
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

function categorizeCommits(commits: Commit[]): Record<string, Commit[]> {
  const categories: Record<string, Commit[]> = {
    'Added': [],
    'Changed': [],
    'Deprecated': [],
    'Removed': [],
    'Fixed': [],
    'Security': []
  };
  
  for (const commit of commits) {
    switch (commit.type) {
      case 'feat':
        categories['Added'].push(commit);
        break;
      case 'fix':
        categories['Fixed'].push(commit);
        break;
      case 'perf':
        categories['Changed'].push(commit);
        break;
      case 'refactor':
        categories['Changed'].push(commit);
        break;
      case 'style':
        // Skip style-only changes
        break;
      case 'test':
        // Skip test-only changes
        break;
      case 'chore':
        // Skip chore-only changes
        break;
      case 'docs':
        // Skip docs-only changes
        break;
      case 'ci':
        // Skip CI-only changes
        break;
      case 'build':
        // Skip build-only changes
        break;
      default:
        categories['Changed'].push(commit);
    }
  }
  
  return categories;
}

function formatCommit(commit: Commit): string {
  const scope = commit.scope ? `**${commit.scope}**: ` : '';
  const breaking = commit.breaking ? ' **BREAKING CHANGE**' : '';
  return `- ${scope}${commit.message}${breaking}`;
}

function generateChangelogSection(version: string, commits: Commit[]): string {
  const categories = categorizeCommits(commits);
  const today = new Date().toISOString().split('T')[0];
  
  let section = `## [${version}] - ${today}\n\n`;
  
  let hasContent = false;
  
  for (const [category, categoryCommits] of Object.entries(categories)) {
    if (categoryCommits.length > 0) {
      section += `### ${category}\n`;
      for (const commit of categoryCommits) {
        section += formatCommit(commit) + '\n';
      }
      section += '\n';
      hasContent = true;
    }
  }
  
  if (!hasContent) {
    section += '### Changed\n- No user-facing changes\n\n';
  }
  
  return section;
}

function updateChangelog(version: string, commits: Commit[]): void {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }
  
  const content = fs.readFileSync(changelogPath, 'utf8');
  const newSection = generateChangelogSection(version, commits);
  
  // Check if section already exists
  if (content.includes(`## [${version}]`)) {
    console.log(`Section for version ${version} already exists in CHANGELOG.md`);
    return;
  }
  
  // Insert new section after [Unreleased]
  const unreleasedIndex = content.indexOf('## [Unreleased]');
  if (unreleasedIndex === -1) {
    console.error('Could not find [Unreleased] section in CHANGELOG.md');
    process.exit(1);
  }
  
  // Find the end of the [Unreleased] section
  const nextSectionIndex = content.indexOf('\n## [', unreleasedIndex + 1);
  const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : content.length;
  
  const newContent = 
    content.substring(0, insertIndex) + 
    '\n' + 
    newSection + 
    content.substring(insertIndex);
  
  fs.writeFileSync(changelogPath, newContent);
  console.log(`Updated CHANGELOG.md with version ${version}`);
}

function main() {
  try {
    const nextVersion = getNextVersion();
    const lastTag = getLastTag();
    const commits = getCommitsSinceTag(lastTag);
    
    if (commits.length === 0) {
      console.log('No commits since last tag, no changelog update needed');
      return;
    }
    
    const parsedCommits = commits
      .map(parseConventionalCommit)
      .filter((commit): commit is Commit => commit !== null);
    
    if (parsedCommits.length === 0) {
      console.log('No conventional commits found, skipping changelog update');
      return;
    }
    
    updateChangelog(nextVersion, parsedCommits);
    
    console.log(`# Generated changelog for version ${nextVersion}`);
    console.log(`# Commits processed: ${parsedCommits.length}`);
    
  } catch (error) {
    console.error('Error generating changelog:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

