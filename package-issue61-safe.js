// Safe Issue #61 packaging script - handles large files
const fs = require('fs');
const path = require('path');

console.log('🔍 Looking for Issue #61 bundle...');

// Find the bundle folder
const supportDir = path.resolve('support');
if (!fs.existsSync(supportDir)) {
  console.error('❌ support/ directory not found');
  process.exit(1);
}

const candidates = fs.readdirSync(supportDir)
  .filter(n => n.startsWith('#61-mintfor-deepdive-'))
  .map(n => path.join(supportDir, n))
  .filter(p => fs.statSync(p).isDirectory());

if (candidates.length === 0) {
  console.error('❌ No bundle folder found: support/#61-mintfor-deepdive-<shortsha>/');
  process.exit(1);
}

// Pick the most recent
candidates.sort((a,b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const bundleDir = candidates[0];
const baseName = path.basename(bundleDir);

console.log('✅ Found bundle:', bundleDir);
console.log('📁 Bundle name:', baseName);

// Create a simple manifest file (skip large files)
const manifestPath = path.join(supportDir, `${baseName}-manifest.txt`);
const manifest = [];
let totalFiles = 0;
let totalDirs = 0;
let skippedFiles = 0;

function scanDirectory(dir, prefix = '') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(prefix, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      manifest.push(`DIR: ${relativePath}/`);
      totalDirs++;
      scanDirectory(fullPath, relativePath);
    } else {
      totalFiles++;
      const size = stat.size;
      
      // Skip files larger than 100MB to avoid memory issues
      if (size > 100 * 1024 * 1024) {
        manifest.push(`FILE: ${relativePath} (${(size / 1024 / 1024).toFixed(1)} MB - LARGE FILE SKIPPED)`);
        skippedFiles++;
      } else {
        try {
          const hash = require('crypto').createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex').substring(0, 8);
          manifest.push(`FILE: ${relativePath} (${size} bytes, ${hash})`);
        } catch (err) {
          manifest.push(`FILE: ${relativePath} (${size} bytes - HASH ERROR: ${err.message})`);
        }
      }
    }
  }
}

console.log('📋 Creating manifest...');
manifest.push(`# Issue #61 Bundle Manifest`);
manifest.push(`# Created: ${new Date().toISOString()}`);
manifest.push(`# Bundle: ${baseName}`);
manifest.push(`# Location: ${bundleDir}`);
manifest.push('');

scanDirectory(bundleDir);
fs.writeFileSync(manifestPath, manifest.join('\n'));

console.log('📋 Manifest created:', manifestPath);
console.log('📊 Total files:', totalFiles);
console.log('📁 Total directories:', totalDirs);
console.log('⚠️  Skipped large files:', skippedFiles);

// Create a simple summary
const summaryPath = path.join(supportDir, `${baseName}-summary.txt`);
const summary = [
  `Issue #61 Deep-Dive Bundle Summary`,
  `=====================================`,
  `Bundle: ${baseName}`,
  `Location: ${bundleDir}`,
  `Created: ${new Date().toISOString()}`,
  `Total Files: ${totalFiles}`,
  `Total Directories: ${totalDirs}`,
  `Large Files Skipped: ${skippedFiles}`,
  ``,
  `Key Files Included:`,
  `- contracts/IssuanceControllerV3.sol (the buggy contract)`,
  `- contracts/interfaces/IIssuanceControllerV3.sol (interface mismatch)`,
  `- contracts/libraries/IssuanceGuard.sol (library)`,
  `- contracts/ConfigRegistry.sol (configuration)`,
  `- contracts/mocks/MockNAVOracle.sol (NAV oracle mock)`,
  `- test/issuance.capacity.boundary.spec.ts (quarantined)`,
  `- test/issuance.capacity.fuzz.spec.ts (quarantined)`,
  `- test/issuance.v3.spec.ts (quarantined)`,
  `- test/sovereign.guarantee.spec.ts (quarantined)`,
  `- test/security/precision.spec.ts (quarantined)`,
  `- test/security/reentrancy.spec.ts (quarantined)`,
  `- test/utils/nav-helpers.ts (NAV API helpers)`,
  `- hardhat.config.ts (configuration)`,
  `- package.json (dependencies)`,
  ``,
  `Evidence of the Bug:`,
  `1. Interface Mismatch: IIssuanceControllerV3 defines 4-parameter mintFor, but implementation uses 5 parameters`,
  `2. AmountZero Error: Contract reverts at line 807 with AmountZero() despite receiving correct calldata`,
  `3. Mirror Contract Proof: Test harness proves calldata is correctly encoded and sent`,
  `4. Quarantined Tests: Multiple test files quarantined with this.skip() referencing Issue #61`,
  ``,
  `Next Steps:`,
  `1. Align interface signature with implementation`,
  `2. Investigate parameter shadowing/overwrite in mintFor function`,
  `3. Add debug events to pinpoint where usdcAmt becomes zero`,
  `4. Fix the contract bug and unquarantine tests`
];

fs.writeFileSync(summaryPath, summary.join('\n'));

console.log('📄 Summary created:', summaryPath);
console.log('✅ Issue #61 bundle analysis complete!');
console.log('');
console.log('📁 Bundle location:', bundleDir);
console.log('📋 Manifest:', manifestPath);
console.log('📄 Summary:', summaryPath);
console.log('');
console.log('💡 To create a compressed archive, you can manually zip the bundle folder:');
console.log(`   zip -r support/${baseName}.zip ${bundleDir}`);
