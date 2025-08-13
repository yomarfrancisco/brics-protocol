#!/usr/bin/env ts-node

/**
 * Audit Bundle Diff Generator
 * 
 * Compares two audit bundles and generates a diff report
 * Usage: ts-node scripts/audit/diff.ts --base manifest-a.json --head manifest-b.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

interface BundleManifest {
  git: {
    commit: string;
    branch: string;
    dirty: boolean;
  };
  contracts: Array<{
    name: string;
    bytecodeHash: string;
    abiHash: string;
  }>;
  fixtures: {
    count: number;
    hash: string;
  };
  tests: {
    unit: { passed: number; failed: number };
    riskApi: { passed: number; failed: number };
  };
}

interface DiffReport {
  summary: {
    contractsChanged: number;
    fixturesChanged: boolean;
    testsChanged: boolean;
  };
  details: {
          contracts: Array<{
        name: string;
        bytecodeChanged: boolean;
        abiChanged: boolean;
        added: boolean;
        removed: boolean;
      }>;
    fixtures: {
      oldHash: string;
      newHash: string;
      changed: boolean;
    };
  };
}

function parseManifest(manifestPath: string): BundleManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function compareManifests(baseManifest: BundleManifest, headManifest: BundleManifest): DiffReport {
  // Compare contracts with detailed analysis
  const contractChanges = baseManifest.contracts.map((baseContract) => {
    const headContract = headManifest.contracts.find((c) => c.name === baseContract.name);
    return {
      name: baseContract.name,
      bytecodeChanged: !headContract || headContract.bytecodeHash !== baseContract.bytecodeHash,
      abiChanged: !headContract || headContract.abiHash !== baseContract.abiHash,
      added: !headContract,
      removed: !baseManifest.contracts.find((c) => c.name === headContract?.name)
    };
  });
  
  // Add new contracts
  headManifest.contracts.forEach((headContract) => {
    if (!baseManifest.contracts.find((c) => c.name === headContract.name)) {
      contractChanges.push({
        name: headContract.name,
        bytecodeChanged: false,
        abiChanged: false,
        added: true,
        removed: false
      });
    }
  });
  
  const contractsChanged = contractChanges.filter(c => c.bytecodeChanged || c.abiChanged || c.added || c.removed).length;
  
  // Compare fixtures
  const fixturesChanged = baseManifest.fixtures.hash !== headManifest.fixtures.hash;
  
  // Compare tests
  const testsChanged = 
    baseManifest.tests.unit.passed !== headManifest.tests.unit.passed ||
    baseManifest.tests.unit.failed !== headManifest.tests.unit.failed ||
    baseManifest.tests.riskApi.passed !== headManifest.tests.riskApi.passed ||
    baseManifest.tests.riskApi.failed !== headManifest.tests.riskApi.failed;
  
  return {
    summary: {
      contractsChanged,
      fixturesChanged,
      testsChanged
    },
    details: {
      contracts: contractChanges,
      fixtures: {
        oldHash: baseManifest.fixtures.hash,
        newHash: headManifest.fixtures.hash,
        changed: fixturesChanged
      }
    }
  };
}

function generateMarkdown(baseManifest: BundleManifest, headManifest: BundleManifest, diff: DiffReport): string {
  let markdown = `# Audit Bundle Diff Report\n\n`;
  markdown += `**Base**: ${baseManifest.git.commit} (${baseManifest.git.branch})\n`;
  markdown += `**Head**: ${headManifest.git.commit} (${headManifest.git.branch})\n\n`;
  
  // Summary
  markdown += `## 📊 Summary\n\n`;
  markdown += `- **Contracts Changed**: ${diff.summary.contractsChanged}\n`;
  markdown += `- **Fixtures Changed**: ${diff.summary.fixturesChanged ? '✅' : '❌'}\n`;
  markdown += `- **Tests Changed**: ${diff.summary.testsChanged ? '✅' : '❌'}\n\n`;
  
  // Details
  if (diff.summary.contractsChanged > 0) {
    markdown += `## 🔧 Contract Changes\n\n`;
    
    // Show added contracts
    const addedContracts = diff.details.contracts.filter(c => c.added);
    if (addedContracts.length > 0) {
      markdown += `### ➕ Added Contracts\n`;
      addedContracts.forEach(contract => {
        markdown += `- **${contract.name}** (new)\n`;
      });
      markdown += `\n`;
    }
    
    // Show removed contracts
    const removedContracts = diff.details.contracts.filter(c => c.removed);
    if (removedContracts.length > 0) {
      markdown += `### ➖ Removed Contracts\n`;
      removedContracts.forEach(contract => {
        markdown += `- **${contract.name}** (removed)\n`;
      });
      markdown += `\n`;
    }
    
    // Show modified contracts
    const modifiedContracts = diff.details.contracts.filter(c => (c.bytecodeChanged || c.abiChanged) && !c.added && !c.removed);
    if (modifiedContracts.length > 0) {
      markdown += `### 🔄 Modified Contracts\n`;
      markdown += `| Contract | Bytecode | ABI |\n`;
      markdown += `|----------|----------|-----|\n`;
      modifiedContracts.forEach(contract => {
        markdown += `| ${contract.name} | ${contract.bytecodeChanged ? '🔄' : '✅'} | ${contract.abiChanged ? '🔄' : '✅'} |\n`;
      });
      markdown += `\n`;
    }
  }
  
  if (diff.summary.fixturesChanged) {
    markdown += `## 📁 Fixture Changes\n\n`;
    markdown += `- **Old Hash**: \`${diff.details.fixtures.oldHash}\`\n`;
    markdown += `- **New Hash**: \`${diff.details.fixtures.newHash}\`\n\n`;
  }
  
  if (diff.summary.testsChanged) {
    markdown += `## 🧪 Test Changes\n\n`;
    markdown += `Test results have changed between bundles.\n\n`;
  }
  
  markdown += `---\n`;
  markdown += `*Generated by audit bundle diff tool*\n`;
  
  return markdown;
}

async function main(): Promise<void> {
  const argv = await yargs
    .option('base', {
      type: 'string',
      description: 'Base manifest path',
      demandOption: true
    })
    .option('head', {
      type: 'string',
      description: 'Head manifest path',
      demandOption: true
    })
    .help()
    .argv;
  
  console.log("🔍 Comparing audit manifests...");
  
  try {
    // Parse manifests
    const baseManifest = parseManifest(argv.base);
    const headManifest = parseManifest(argv.head);
    
    // Compare
    console.log("🔍 Comparing manifests...");
    const diff = compareManifests(baseManifest, headManifest);
    
    // Generate report
    const markdown = generateMarkdown(baseManifest, headManifest, diff);
    const reportPath = path.join(process.cwd(), 'dist', 'audit', 'diff.md');
    
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    
    fs.writeFileSync(reportPath, markdown);
    console.log(`✅ Diff report generated: ${reportPath}`);
    
    // Print summary
    console.log("\n📊 Diff Summary:");
    console.log(`- Contracts changed: ${diff.summary.contractsChanged}`);
    console.log(`- Fixtures changed: ${diff.summary.fixturesChanged}`);
    console.log(`- Tests changed: ${diff.summary.testsChanged}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
