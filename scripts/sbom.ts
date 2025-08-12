#!/usr/bin/env ts-node

import { readFileSync, writeFileSync } from 'fs';

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface SBOMEntry {
  name: string;
  version: string;
  type: 'production' | 'development';
}

function generateNodeSBOM() {
  console.log('📦 Generating Node.js SBOM...');
  
  const packageJson: PackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const yarnLock = readFileSync('yarn.lock', 'utf8');
  
  const sbom: SBOMEntry[] = [];
  
  // Add production dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      sbom.push({
        name,
        version,
        type: 'production'
      });
    }
  }
  
  // Add development dependencies
  if (packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      sbom.push({
        name,
        version,
        type: 'development'
      });
    }
  }
  
  // Sort by name
  sbom.sort((a, b) => a.name.localeCompare(b.name));
  
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      tool: 'brics-protocol-sbom',
      project: {
        name: packageJson.name,
        version: packageJson.version
      }
    },
    dependencies: sbom
  };
  
  writeFileSync('sbom-node.json', JSON.stringify(output, null, 2));
  console.log(`✅ Generated sbom-node.json with ${sbom.length} dependencies`);
}

generateNodeSBOM();
