#!/usr/bin/env ts-node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const LICENSE_HEADER = '// SPDX-License-Identifier: MIT';

function findSolidityFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dir, item.name);
      
      if (item.isDirectory()) {
        files.push(...findSolidityFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith('.sol')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return files;
}

function checkLicenseHeaders() {
  console.log('🔍 Checking license headers...');
  
  const solidityFiles = findSolidityFiles('contracts');
  let missingHeaders = 0;
  
  for (const file of solidityFiles) {
    if (!existsSync(file)) continue;
    
    const content = readFileSync(file, 'utf8');
    if (!content.includes(LICENSE_HEADER)) {
      console.error(`❌ Missing license header: ${file}`);
      missingHeaders++;
    }
  }
  
  if (missingHeaders > 0) {
    console.error(`\n❌ Found ${missingHeaders} files missing license headers`);
    process.exit(1);
  }
  
  console.log('✅ All Solidity files have license headers');
}

checkLicenseHeaders();
