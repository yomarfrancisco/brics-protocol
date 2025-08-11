import { ethers } from "hardhat";
import * as fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface StatusReport {
  network: string;
  timestamp: string;
  blockNumber: number;
  summary: {
    totalSupply: string;
    totalIssued: string;
    reservedForNav: string;
    superSeniorCap: string;
  };
  sovereigns: Array<{
    code: string;
    utilization: string;
    remainingCapacity: string;
  }>;
  emergency: {
    level: number;
    oracleDegradation: number;
    haircut: number;
  };
  buffer: {
    instantCapacity: string;
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('network', {
      type: 'string',
      description: 'Network name',
      demandOption: true
    })
    .option('addresses', {
      type: 'string',
      description: 'Path to addresses JSON',
      demandOption: true
    })
    .argv;

  console.log(`📊 BRICS Protocol Status - ${argv.network}`);

  // Load addresses
  const addresses = JSON.parse(fs.readFileSync(argv.addresses, 'utf8'));
  
  // Get current block
  const block = await ethers.provider.getBlock("latest");
  const timestamp = new Date().toISOString();

  const report: StatusReport = {
    network: argv.network,
    timestamp,
    blockNumber: block?.number || 0,
    summary: {
      totalSupply: "0",
      totalIssued: "0",
      reservedForNav: "0",
      superSeniorCap: "0"
    },
    sovereigns: [],
    emergency: {
      level: 0,
      oracleDegradation: 0,
      haircut: 0
    },
    buffer: {
      instantCapacity: "0"
    }
  };

  try {
    // Get contract instances
    const token = await ethers.getContractAt("BRICSToken", addresses.BRICSToken);
    const ic = await ethers.getContractAt("IssuanceControllerV3", addresses.IssuanceControllerV3);
    const tm = await ethers.getContractAt("TrancheManagerV2", addresses.TrancheManagerV2);
    const cfg = await ethers.getContractAt("ConfigRegistry", addresses.ConfigRegistry);
    const nav = await ethers.getContractAt("NAVOracleV3", addresses.NAVOracleV3);
    const pre = await ethers.getContractAt("PreTrancheBuffer", addresses.PreTrancheBuffer);

    // Get summary data
    const totalSupply = await token.totalSupply();
    const totalIssued = await ic.totalIssued();
    
    // Get reserved for NAV (try different approaches)
    let reservedForNav = BigInt(0);
    try {
      reservedForNav = await ic.reservedForNav();
    } catch (e) {
      try {
        // Alternative approach if reservedForNav doesn't exist
        const currentWindow = await ic.currentWindowId();
        if (currentWindow > 0) {
          const window = await ic.navWindows(currentWindow);
          reservedForNav = window.totalRequested;
        }
      } catch (e2) {
        console.log("⚠️  Could not get reserved for NAV:", e2);
      }
    }
    
    const superSeniorCap = await tm.superSeniorCap();

    report.summary = {
      totalSupply: totalSupply.toString(),
      totalIssued: totalIssued.toString(),
      reservedForNav: reservedForNav.toString(),
      superSeniorCap: superSeniorCap.toString()
    };

    // Get sovereign data
    const sovereignCodes = ["ZA", "BR"];
    for (const code of sovereignCodes) {
      try {
        const sovereignCode = ethers.encodeBytes32String(code);
        const utilization = await ic.getSovereignUtilization(sovereignCode);
        
        // Try to get capacity - handle different function names
        let capacity = BigInt(0);
        try {
          const capacityDebug = await ic.getSovereignCapacityDebug(sovereignCode);
          capacity = capacityDebug.remUSDC;
        } catch (e) {
          try {
            // Alternative approach
            const softCap = await ic.sovereignSoftCap(sovereignCode);
            const hardCap = await ic.sovereignHardCap(sovereignCode);
            capacity = hardCap - utilization;
          } catch (e2) {
            console.log(`⚠️  Could not get capacity for sovereign ${code}:`, e2);
          }
        }
        
        report.sovereigns.push({
          code,
          utilization: utilization.toString(),
          remainingCapacity: capacity.toString()
        });
      } catch (error) {
        console.log(`⚠️  Error getting sovereign ${code} data: ${error}`);
        report.sovereigns.push({
          code,
          utilization: "0",
          remainingCapacity: "0"
        });
      }
    }

    // Get emergency data
    try {
      const emergencyParams = await cfg.getEmergencyParams();
      const degradationLevel = await nav.getDegradationLevel();
      
      report.emergency = {
        level: Number(emergencyParams.level),
        oracleDegradation: Number(degradationLevel),
        haircut: Number(emergencyParams.tailCorrMaxPpm)
      };
    } catch (error) {
      console.log(`⚠️  Error getting emergency data: ${error}`);
    }

    // Get buffer data
    try {
      const bufferStatus = await pre.getBufferStatus();
      report.buffer.instantCapacity = bufferStatus.availableInstantCapacity.toString();
    } catch (error) {
      console.log(`⚠️  Error getting buffer data: ${error}`);
    }

  } catch (error) {
    console.log(`⚠️  Error getting status data: ${error}`);
  }

  // Print pretty console output
  console.log(`\n📈 Protocol Summary:`);
  console.log(`   Total Supply: ${ethers.formatEther(report.summary.totalSupply)} BRICS`);
  console.log(`   Total Issued: ${ethers.formatEther(report.summary.totalIssued)} BRICS`);
  console.log(`   Reserved for NAV: ${ethers.formatEther(report.summary.reservedForNav)} BRICS`);
  console.log(`   Super Senior Cap: ${ethers.formatEther(report.summary.superSeniorCap)} BRICS`);

  console.log(`\n🏛️  Sovereign Utilization:`);
  for (const sov of report.sovereigns) {
    const util = ethers.formatUnits(sov.utilization, 6);
    const remaining = ethers.formatUnits(sov.remainingCapacity, 6);
    console.log(`   ${sov.code}: ${util} USDC utilized, ${remaining} USDC remaining`);
  }

  console.log(`\n🚨 Emergency Status:`);
  console.log(`   Level: ${report.emergency.level} (${getEmergencyLevelName(report.emergency.level)})`);
  console.log(`   Oracle Degradation: ${report.emergency.oracleDegradation}`);
  console.log(`   Haircut: ${report.emergency.haircut} ppm`);

  console.log(`\n💰 Buffer Status:`);
  const bufferCapacity = ethers.formatUnits(report.buffer.instantCapacity, 6);
  console.log(`   Instant Capacity: ${bufferCapacity} USDC`);

  // Save JSON report
  fs.mkdirSync('audit', { recursive: true });
  fs.writeFileSync(`audit/status-${argv.network}.json`, JSON.stringify(report, null, 2));

  console.log(`\n📄 Status report saved to audit/status-${argv.network}.json`);
}

function getEmergencyLevelName(level: number): string {
  switch (level) {
    case 0: return "NORMAL";
    case 1: return "YELLOW";
    case 2: return "ORANGE";
    case 3: return "RED";
    default: return "UNKNOWN";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
