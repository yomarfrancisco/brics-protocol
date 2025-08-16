import { HardhatUserConfig } from "hardhat/config";
import "hardhat-gas-reporter";
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
import "./tasks/swap.demo";
import "./tasks/pricing.fixture";
import "./tasks/dev/bootstrap";

const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const ENABLE_GAS = !!process.env.REPORT_GAS && !process.env.COVERAGE;
const COVERAGE = !!process.env.COVERAGE;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: COVERAGE
      ? { optimizer: { enabled: true, runs: 1 }, viaIR: true }  // minimal optimization with viaIR
      : { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      initialBaseFeePerGas: 0,
      gasPrice: 'auto',
      mining: {
        auto: true,
        interval: 0
      }
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
  gasReporter: {
    enabled: process.env.GAS_REPORT === "true",
    currency: "USD",
    // Keep this deterministic / offline unless you explicitly set a key:
    coinmarketcap: undefined,
    outputFile: "gas-report.txt",
    noColors: true,
    // Optional: tighten for noisy suites
    showTimeSpent: true,
    excludeContracts: [],
    // Optional: gasPrice in gwei (deterministic)
    gasPrice: 1,
  },

  mocha: {
    reporter: 'min', // Centralized minimal reporter (was previously --reporter min CLI flag)
    timeout: 60000,
    retries: process.env.CI ? 1 : 0,
    bail: true,
    require: ["test/bootstrap.ts"]
  }
};

export default config;
