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
} catch (error) {
  console.error('Error reading fixture:', error);
  process.exit(1);
}
