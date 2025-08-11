// scripts/slither-filter.js
// Usage: node scripts/slither-filter.js allowlist.json input.sarif output.sarif

const fs = require('fs');

if (process.argv.length < 5) {
  console.error('Usage: node scripts/slither-filter.js allowlist.json input.sarif output.sarif');
  process.exit(1);
}

const [allowlistPath, inputPath, outputPath] = process.argv.slice(2);

// Load allowlist
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

// Create a Set of fingerprints for O(1) lookup
// Fingerprint format: `${ruleId}:${file}:${line}`
const allowed = new Set(
  allowlist.allowlist.map(a => `${a.rule}:${a.file}:${a.line}`)
);

// Load SARIF
const sarif = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const run = sarif.runs?.[0];
if (!run) {
  console.error('Invalid SARIF file format');
  process.exit(1);
}

const originalCount = run.results.length;

// Filter results
run.results = run.results.filter(result => {
  const ruleId = result.ruleId || result.rule?.id || '';
  const loc = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || '';
  const line = result.locations?.[0]?.physicalLocation?.region?.startLine || '';
  const fingerprint = `${ruleId}:${loc}:${line}`;
  return !allowed.has(fingerprint);
});

const filteredCount = run.results.length;

// Save filtered SARIF
fs.writeFileSync(outputPath, JSON.stringify(sarif, null, 2));

console.log(`Filtered ${originalCount - filteredCount} findings (remaining: ${filteredCount})`);
