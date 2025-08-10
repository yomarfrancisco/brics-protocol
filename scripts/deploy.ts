import { execSync } from 'child_process';
import { ethers } from 'hardhat';

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
  
  console.log(`🚀 Starting full deployment to network: ${networkName}`);
  console.log(`📡 Using provider: ${(await ethers.provider.getNetwork()).name}`);
  
  const deployScripts = [
    '00_env.ts',
    '01_core.ts', 
    '02_finance.ts',
    '04_oracle.ts',
    '03_tranche.ts',
    '05_issuance_and_claims.ts',
    '90_roles_and_params.ts',
    '99_report.ts'
  ];

  try {
    for (const script of deployScripts) {
      console.log(`\n📄 Running deploy/${script}...`);
      execSync(`npx hardhat run --network ${networkName} deploy/${script}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ Completed deploy/${script}`);
    }
    
    console.log(`\n🎉 Full deployment completed successfully on ${networkName}!`);
    console.log(`📋 Check deployment addresses in deployments-${networkName}.json`);
    
  } catch (error) {
    console.error(`❌ Deployment failed:`, error);
    process.exit(1);
  }
}

// Allow direct execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as deploy };
