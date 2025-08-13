#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

interface ContractInfo {
  name: string;
  abi: any[];
  bytecode?: string;
  deployedBytecode?: string;
  storageLayout?: any;
}

interface StorageSlot {
  contract: string;
  slot: string;
  offset: number;
  type: string;
  astId: number;
}

function collectABIs(): ContractInfo[] {
  const artifactsDir = path.join(process.cwd(), "artifacts", "contracts");
  const contracts: ContractInfo[] = [];

  if (!fs.existsSync(artifactsDir)) {
    console.log("⚠️  No artifacts directory found. Run 'yarn hardhat compile' first.");
    return [];
  }

  function walkDir(dir: string): void {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith(".json") && !file.includes(".dbg.")) {
        try {
          const artifact = JSON.parse(fs.readFileSync(filePath, "utf8"));
          
          if (artifact.abi && Array.isArray(artifact.abi)) {
            const contractName = path.basename(file, ".json");
            const relativePath = path.relative(artifactsDir, filePath);
            const fullName = relativePath.replace(/\.json$/, "");
            
            contracts.push({
              name: fullName,
              abi: artifact.abi,
              bytecode: artifact.bytecode,
              deployedBytecode: artifact.deployedBytecode
            });
          }
        } catch (error) {
          console.log(`⚠️  Failed to parse ${filePath}: ${error}`);
        }
      }
    }
  }

  walkDir(artifactsDir);
  return contracts;
}

function collectStorageLayout(): Record<string, any> {
  const buildInfoDir = path.join(process.cwd(), "artifacts", "build-info");
  const storageLayout: Record<string, any> = {};

  if (!fs.existsSync(buildInfoDir)) {
    console.log("⚠️  No build-info directory found. Storage layout may not be available.");
    return storageLayout;
  }

  try {
    const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(f => f.endsWith(".json"));
    
    for (const buildFile of buildInfoFiles) {
      const buildInfo = JSON.parse(fs.readFileSync(path.join(buildInfoDir, buildFile), "utf8"));
      
      if (buildInfo.output && buildInfo.output.contracts) {
        for (const [sourceFile, contracts] of Object.entries(buildInfo.output.contracts)) {
          for (const [contractName, contractInfo] of Object.entries(contracts as any)) {
            const fullName = `${sourceFile}:${contractName}`;
            
            if ((contractInfo as any).storageLayout) {
              storageLayout[fullName] = (contractInfo as any).storageLayout;
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(`⚠️  Failed to collect storage layout: ${error}`);
  }

  return storageLayout;
}

function generateStorageSummary(storageLayout: Record<string, any>): Record<string, any> {
  const summary: Record<string, any> = {};

  for (const [contractName, layout] of Object.entries(storageLayout)) {
    if (layout.storage && Array.isArray(layout.storage)) {
      summary[contractName] = {
        slotCount: layout.storage.length,
        slots: layout.storage.map((slot: any) => ({
          slot: slot.slot,
          offset: slot.offset,
          type: slot.type,
          label: slot.label
        }))
      };
    }
  }

  return summary;
}

function main() {
  console.log("🔒 Freezing ABI and storage layout for audit...");

  // Collect ABIs
  const contracts = collectABIs();
  console.log(`📦 Found ${contracts.length} contracts with ABIs`);

  // Sort contracts by name for deterministic output
  contracts.sort((a, b) => a.name.localeCompare(b.name));

  // Create ABI bundle
  const abiBundle: Record<string, any> = {};
  for (const contract of contracts) {
    abiBundle[contract.name] = {
      abi: contract.abi,
      bytecode: contract.bytecode,
      deployedBytecode: contract.deployedBytecode
    };
  }

  // Collect storage layout
  const storageLayout = collectStorageLayout();
  console.log(`🗄️  Found storage layout for ${Object.keys(storageLayout).length} contracts`);

  // Generate storage summary
  const storageSummary = generateStorageSummary(storageLayout);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), "dist", "audit");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write ABI bundle
  const abiPath = path.join(outputDir, "abi.json");
  fs.writeFileSync(abiPath, JSON.stringify(abiBundle, null, 2));
  console.log(`💾 ABI bundle written to ${abiPath}`);

  // Write storage layout
  const storagePath = path.join(outputDir, "storage-layout.json");
  fs.writeFileSync(storagePath, JSON.stringify(storageLayout, null, 2));
  console.log(`💾 Storage layout written to ${storagePath}`);

  // Write storage summary
  const summaryPath = path.join(outputDir, "storage-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(storageSummary, null, 2));
  console.log(`💾 Storage summary written to ${summaryPath}`);

  // Generate lock files
  const abiHash = createHash("sha256").update(JSON.stringify(abiBundle)).digest("hex");
  const storageHash = createHash("sha256").update(JSON.stringify(storageLayout)).digest("hex");

  fs.writeFileSync(path.join(outputDir, "abi.lock"), abiHash);
  fs.writeFileSync(path.join(outputDir, "storage.lock"), storageHash);

  console.log(`🔐 ABI lock: ${abiHash}`);
  console.log(`🔐 Storage lock: ${storageHash}`);

  // Generate summary report
  const report = {
    timestamp: new Date().toISOString(),
    contracts: contracts.length,
    abiHash,
    storageHash,
    contractNames: contracts.map(c => c.name),
    storageContracts: Object.keys(storageLayout)
  };

  const reportPath = path.join(outputDir, "freeze-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Freeze report written to ${reportPath}`);

  console.log("✅ ABI and storage freeze complete!");
}

if (require.main === module) {
  main();
}
