import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "./tasks/governance";
import "./tasks/confirmSovereign";
import "./tasks/mintMember";
import "./tasks/raiseDetachment";
import "./tasks/setEmergencyLevel";
import "./tasks/setOracleDegradation";
import "./tasks/emergencyExpandSoftCap";

const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { 
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
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
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 21,
    showMethodSig: true,
    showTimeSpent: true,
    outputFile: "gas-report.txt",
    noColors: true
  },
  coverage: {
    reporter: ["text", "lcov", "html"],
    exclude: [
      "contracts/mocks/",
      "test/",
      "deploy/"
    ]
  },
  mocha: {
    timeout: 10000,
    bail: 1
  }
};

export default config;
