#!/usr/bin/env ts-node

import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const [jsonFile, checksumFile] = process.argv.slice(2);

if (!jsonFile || !checksumFile) {
  console.error('Usage: ts-node scripts/check-fixture-drift.ts <json-file> <checksum-file>');
  process.exit(1);
}

try {
  // Read the JSON file
  const jsonContent = readFileSync(jsonFile, 'utf8');
  
  // Read the stored checksum
  const storedChecksum = readFileSync(checksumFile, 'utf8').trim();
  
  // Compute current checksum
  const currentChecksum = createHash('sha256').update(jsonContent).digest('hex');
  
  console.log(`Stored checksum:  ${storedChecksum}`);
  console.log(`Current checksum: ${currentChecksum}`);
  
  if (currentChecksum !== storedChecksum) {
    console.error('❌ Fixture drift detected! Checksums do not match.');
    process.exit(1);
  }
  
  console.log('✅ Fixture checksum verified - no drift detected.');
} catch (error) {
  console.error('Error checking fixture drift:', error);
  process.exit(1);
}
