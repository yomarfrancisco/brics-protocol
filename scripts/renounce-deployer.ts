import { ethers } from "hardhat";
import * as fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface RenounceReport {
  network: string;
  deployer: string;
  before: Array<{ contract: string; role: string; hasRole: boolean }>;
  after: Array<{ contract: string; role: string; hasRole: boolean }>;
  renounced: Array<{ contract: string; role: string; txHash?: string }>;
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
    .option('execute', {
      type: 'boolean',
      description: 'Execute renounce transactions',
      default: false
    })
    .argv;

  console.log(`🔐 Deployer renounce script (${argv.execute ? 'EXECUTE' : 'DRY-RUN'})`);
  console.log(`Network: ${argv.network}`);

  // Load addresses
  const addresses = JSON.parse(fs.readFileSync(argv.addresses, 'utf8'));
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const report: RenounceReport = {
    network: argv.network,
    deployer: deployerAddress,
    before: [],
    after: [],
    renounced: []
  };

  // Define contracts and their roles
  const contracts = [
    { name: 'BRICSToken', address: addresses.BRICSToken, roles: ['MINTER_ROLE', 'BURNER_ROLE'] },
    { name: 'IssuanceControllerV3', address: addresses.IssuanceControllerV3, roles: ['OPS_ROLE', 'BURNER_ROLE'] },
    { name: 'PreTrancheBuffer', address: addresses.PreTrancheBuffer, roles: ['BUFFER_MANAGER'] },
    { name: 'Treasury', address: addresses.Treasury, roles: ['PAY_ROLE'] },
    { name: 'ClaimRegistry', address: addresses.ClaimRegistry, roles: ['ECC_ROLE', 'OPS_ROLE'] },
    { name: 'TrancheManagerV2', address: addresses.TrancheManagerV2, roles: ['ECC_ROLE'] },
    { name: 'ConfigRegistry', address: addresses.ConfigRegistry, roles: ['GOV_ROLE'] },
    { name: 'MemberRegistry', address: addresses.MemberRegistry, roles: ['DEFAULT_ADMIN_ROLE'] },
    { name: 'NAVOracleV3', address: addresses.NAVOracleV3, roles: ['DEFAULT_ADMIN_ROLE'] },
    { name: 'RedemptionClaim', address: addresses.RedemptionClaim, roles: ['ISSUER_ROLE', 'BURNER_ROLE'] }
  ];

  console.log(`\n📋 Checking roles for deployer: ${deployerAddress}`);

  // Check before state
  for (const contract of contracts) {
    const contractInstance = await ethers.getContractAt(contract.name, contract.address);
    
    for (const roleName of contract.roles) {
      try {
        const role = await contractInstance[roleName]();
        const hasRole = await contractInstance.hasRole(role, deployerAddress);
        
        report.before.push({
          contract: contract.name,
          role: roleName,
          hasRole
        });

        if (hasRole) {
          console.log(`⚠️  ${contract.name}.${roleName}: DEPLOYER HAS ROLE`);
          
          if (argv.execute) {
            console.log(`   🔄 Renouncing ${contract.name}.${roleName}...`);
            try {
              const tx = await contractInstance.connect(deployer).renounceRole(role, deployerAddress);
              const receipt = await tx.wait();
              
              report.renounced.push({
                contract: contract.name,
                role: roleName,
                txHash: tx.hash
              });
              
              console.log(`   ✅ Renounced (tx: ${tx.hash})`);
            } catch (error) {
              console.log(`   ❌ Failed to renounce: ${error}`);
            }
          } else {
            report.renounced.push({
              contract: contract.name,
              role: roleName
            });
          }
        } else {
          console.log(`✅ ${contract.name}.${roleName}: deployer does not have role`);
        }
      } catch (error) {
        console.log(`⚠️  ${contract.name}.${roleName}: error checking role - ${error}`);
      }
    }
  }

  // Check after state
  if (argv.execute) {
    console.log(`\n📋 Checking roles after renounce...`);
    
    for (const contract of contracts) {
      const contractInstance = await ethers.getContractAt(contract.name, contract.address);
      
      for (const roleName of contract.roles) {
        try {
          const role = await contractInstance[roleName]();
          const hasRole = await contractInstance.hasRole(role, deployerAddress);
          
          report.after.push({
            contract: contract.name,
            role: roleName,
            hasRole
          });
        } catch (error) {
          console.log(`⚠️  ${contract.name}.${roleName}: error checking after state - ${error}`);
        }
      }
    }
  }

  // Save report
  fs.mkdirSync('audit', { recursive: true });
  fs.writeFileSync('audit/renounce-report.json', JSON.stringify(report, null, 2));

  console.log(`\n📄 Report saved to audit/renounce-report.json`);
  
  if (argv.execute) {
    console.log(`\n✅ Deployer renounce ${report.renounced.length > 0 ? 'completed' : 'no roles to renounce'}`);
  } else {
    console.log(`\n📋 Dry run complete. Found ${report.renounced.length} roles to renounce.`);
    console.log(`   Run with --execute to perform renounce operations.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
