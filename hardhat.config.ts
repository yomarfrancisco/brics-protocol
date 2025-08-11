import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "solidity-coverage";
import "./tasks/governance";
import "./tasks/confirmSovereign";
import "./tasks/mintMember";
import "./tasks/raiseDetachment";
import "./tasks/setEmergencyLevel";
import "./tasks/setOracleDegradation";
import "./tasks/emergencyExpandSoftCap";
import "./tasks/deploy.core";
import "./tasks/roles.wire";
import "./tasks/roles.audit";

const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const ENABLE_GAS = !!process.env.REPORT_GAS && !process.env.COVERAGE;
const COVERAGE = !!process.env.COVERAGE;

// Conditionally import hardhat-gas-reporter only when needed
if (ENABLE_GAS) {
  require("hardhat-gas-reporter");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: COVERAGE
      ? { optimizer: { enabled: true, runs: 1 }, viaIR: true }  // minimal optimization with viaIR
      : { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || ""
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6"
  },
  gasReporter: ENABLE_GAS ? {
    enabled: true,
    currency: 'USD',
    coinmarketcap: undefined,
    excludeContracts: ['mocks/'],
    noColors: true,
    showTimeSpent: true,
    showMethodSig: true
  } : {
    enabled: false
  },
  coverage: {
    reporter: ["text", "lcov", "html"],
    exclude: [
      "contracts/mocks/",
      "contracts/malicious/",
      "test/",
      "deploy/"
    ]
  },
  mocha: {
    timeout: COVERAGE ? 180000 : 60000,
    bail: 1,
    reporter: 'spec'
  }
};

export default config;
