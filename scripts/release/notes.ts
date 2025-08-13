#!/usr/bin/env ts-node

/**
 * Release Notes Generator
 * 
 * Builds Markdown release notes using categorized commits.
 * Usage: ts-node scripts/release/notes.ts
 * 
 * Writes to dist/release-notes.md
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
    '🚀 Features': [],
    '🐛 Bug Fixes': [],
    '⚡ Performance': [],
    '🔧 Maintenance': [],
    '📚 Documentation': [],
    '🧪 Testing': [],
    '🔒 Security': []
  };
  
  for (const commit of commits) {
    switch (commit.type) {
      case 'feat':
        categories['🚀 Features'].push(commit);
        break;
      case 'fix':
        categories['🐛 Bug Fixes'].push(commit);
        break;
      case 'perf':
        categories['⚡ Performance'].push(commit);
        break;
      case 'refactor':
        categories['🔧 Maintenance'].push(commit);
        break;
      case 'style':
        categories['🔧 Maintenance'].push(commit);
        break;
      case 'test':
        categories['🧪 Testing'].push(commit);
        break;
      case 'chore':
        categories['🔧 Maintenance'].push(commit);
        break;
      case 'docs':
        categories['📚 Documentation'].push(commit);
        break;
      case 'ci':
        categories['🔧 Maintenance'].push(commit);
        break;
      case 'build':
        categories['🔧 Maintenance'].push(commit);
        break;
      case 'security':
        categories['🔒 Security'].push(commit);
        break;
      default:
        categories['🔧 Maintenance'].push(commit);
    }
  }
  
  return categories;
}

function formatCommit(commit: Commit): string {
  const scope = commit.scope ? `**${commit.scope}**: ` : '';
  const breaking = commit.breaking ? ' ⚠️ **BREAKING CHANGE**' : '';
  return `- ${scope}${commit.message}${breaking}`;
}

function generateReleaseNotes(version: string, commits: Commit[]): string {
  const categories = categorizeCommits(commits);
  const today = new Date().toISOString().split('T')[0];
  
  let notes = `# BRICS Protocol v${version}\n\n`;
  notes += `*Released on ${today}*\n\n`;
  
  // Summary
  const totalCommits = commits.length;
  const breakingChanges = commits.filter(c => c.breaking).length;
  const features = categories['🚀 Features'].length;
  const fixes = categories['🐛 Bug Fixes'].length;
  
  notes += `## 📊 Summary\n\n`;
  notes += `- **${totalCommits}** commits included\n`;
  notes += `- **${features}** new features\n`;
  notes += `- **${fixes}** bug fixes\n`;
  if (breakingChanges > 0) {
    notes += `- **${breakingChanges}** breaking changes ⚠️\n`;
  }
  notes += `\n`;
  
  // Breaking changes warning
  if (breakingChanges > 0) {
    notes += `## ⚠️ Breaking Changes\n\n`;
    notes += `This release includes breaking changes. Please review the migration guide before upgrading.\n\n`;
  }
  
  // Categories
  for (const [category, categoryCommits] of Object.entries(categories)) {
    if (categoryCommits.length > 0) {
      notes += `## ${category}\n\n`;
      for (const commit of categoryCommits) {
        notes += formatCommit(commit) + '\n';
      }
      notes += '\n';
    }
  }
  
  // Footer
  notes += `---\n\n`;
  notes += `For detailed information, see the [CHANGELOG.md](../CHANGELOG.md).\n\n`;
  notes += `## 🔗 Links\n\n`;
  notes += `- [Documentation](https://docs.bricsprotocol.com)\n`;
  notes += `- [GitHub Repository](https://github.com/bricsprotocol/brics-protocol)\n`;
  notes += `- [Discord Community](https://discord.gg/bricsprotocol)\n`;
  
  return notes;
}

function writeReleaseNotes(version: string, commits: Commit[]): void {
  const distDir = path.join(process.cwd(), 'dist');
  const notesPath = path.join(distDir, 'release-notes.md');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  const notes = generateReleaseNotes(version, commits);
  fs.writeFileSync(notesPath, notes);
  
  console.log(`Generated release notes: ${notesPath}`);
}

function main() {
  try {
    const nextVersion = getNextVersion();
    const lastTag = getLastTag();
    const commits = getCommitsSinceTag(lastTag);
    
    if (commits.length === 0) {
      console.log('No commits since last tag, no release notes needed');
      return;
    }
    
    const parsedCommits = commits
      .map(parseConventionalCommit)
      .filter((commit): commit is Commit => commit !== null);
    
    if (parsedCommits.length === 0) {
      console.log('No conventional commits found, generating minimal release notes');
      writeReleaseNotes(nextVersion, []);
      return;
    }
    
    writeReleaseNotes(nextVersion, parsedCommits);
    
    console.log(`# Generated release notes for version ${nextVersion}`);
    console.log(`# Commits processed: ${parsedCommits.length}`);
    
  } catch (error) {
    console.error('Error generating release notes:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

