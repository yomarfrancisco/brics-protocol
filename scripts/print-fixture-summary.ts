#!/usr/bin/env ts-node

import { readFileSync } from 'fs';

const fixturePath = 'pricing-fixtures/ACME-LLC-30-latest.json';
const checksumPath = 'pricing-fixtures/ACME-LLC-30-latest.sha256';

try {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const sha256 = readFileSync(checksumPath, 'utf8').trim();
  
  console.log('Fixture Summary:');
  console.log(`  Signer: ${fixture.signer}`);
  console.log(`  Digest: ${fixture.digest}`);
  console.log(`  SHA256: ${sha256}`);
  console.log(`  File: ${fixturePath}`);
  
  // Emit key=value lines for GitHub Actions if --gha flag is used
  const gha = process.argv.includes("--gha");
  if (gha) {
    console.log(`signer=${fixture.signer}`);
    console.log(`digest=${fixture.digest}`);
    console.log(`asof=${fixture.asOf}`);
    console.log(`path=${fixturePath}`);
  }
} catch (error) {
  console.error('Error reading fixture:', error);
  process.exit(1);
}
