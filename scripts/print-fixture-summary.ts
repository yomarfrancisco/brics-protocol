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
  
  // Emit key=value lines for GitHub Actions if GITHUB_OUTPUT is set
  if (process.env.GITHUB_OUTPUT) {
    const output = [
      `signer=${fixture.signer}`,
      `digest=${fixture.digest}`,
      `sha256=${sha256}`,
      `asOf=${fixture.asOf}`
    ].join('\n');
    
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + '\n');
  }
} catch (error) {
  console.error('Error reading fixture:', error);
  process.exit(1);
}
