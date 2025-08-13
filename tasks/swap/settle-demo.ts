import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { makePricingProvider } from "../../scripts/pricing/providers/factory";
import * as fs from "fs";
import * as path from "path";

interface DemoParams {
  obligor: string;
  tenor: number;
  asof: number;
  notional: number;
  fixedSpread: number;
  elapsedDays?: number;
  outputPath?: string;
}

task("swap:settle-demo", "End-to-end CDS swap settlement demo with ACCOUNTING and TRANSFERS modes")
  .addParam("obligor", "Obligor ID (e.g., ACME-LLC)")
  .addParam("tenor", "Tenor in days")
  .addParam("asof", "As-of timestamp")
  .addParam("notional", "Notional amount in USDC")
  .addParam("fixedSpread", "Fixed spread in basis points")
  .addOptionalParam("elapsedDays", "Days elapsed since swap start (default: tenor/2)")
  .addOptionalParam("outputPath", "Output JSON path (default: dist/demo/demo_settlement.json)")
  .setAction(async (taskArgs: DemoParams, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { keccak256, toUtf8Bytes, AbiCoder } = ethers;
    
    console.log("🚀 Starting CDS Swap Settlement E2E Demo...");
    console.log(`📋 Parameters: ${taskArgs.obligor}, ${taskArgs.tenor}d, ${taskArgs.asof}, $${taskArgs.notional}, ${taskArgs.fixedSpread}bps`);

    const [deployer, buyer, seller] = await hre.ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 Buyer: ${buyer.address}`);
    console.log(`👤 Seller: ${seller.address}`);

    // Step 1: Deploy contracts
    console.log("\n📦 Deploying contracts...");
    const CdsSwapEngine = await hre.ethers.getContractFactory("CdsSwapEngine");
    const cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
    await cdsSwapEngine.waitForDeployment();
    console.log(`✅ CdsSwapEngine deployed: ${await cdsSwapEngine.getAddress()}`);

    // Deploy MockUSDC
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    console.log(`✅ MockUSDC deployed: ${await mockUSDC.getAddress()}`);

    // Step 2: Set up price oracle (mock for demo)
    console.log("\n🔗 Setting up price oracle...");
    const MockPriceOracle = await hre.ethers.getContractFactory("MockPriceOracleAdapter");
    
    // Use the same private key for the risk oracle if STUB_SIGN is enabled
    let riskOracleAddress = deployer.address;
    if (process.env.STUB_SIGN === "1") {
        const riskOracleKey = process.env.RISK_ORACLE_PRIVATE_KEY || "0x000000000000000000000000000000000000000000000000000000000000002a";
        const riskOracleWallet = new hre.ethers.Wallet(riskOracleKey);
        riskOracleAddress = riskOracleWallet.address;
        console.log(`🔑 Using risk oracle address: ${riskOracleAddress} (from private key)`);
    }
    
    const mockOracle = await MockPriceOracle.deploy(riskOracleAddress);
    await mockOracle.waitForDeployment();
    console.log(`✅ Mock oracle deployed: ${await mockOracle.getAddress()}`);

    await cdsSwapEngine.setPriceOracle(await mockOracle.getAddress());
    await cdsSwapEngine.setSettlementToken(await mockUSDC.getAddress());
    console.log("✅ Price oracle and settlement token configured");

    // Grant broker role to deployer
    await cdsSwapEngine.grantRole(await cdsSwapEngine.BROKER_ROLE(), deployer.address);
    console.log("✅ Broker role granted to deployer");

    // Step 3: Mint USDC to buyer and seller
    console.log("\n💰 Minting USDC to counterparties...");
    const notionalAmount = ethers.parseUnits(taskArgs.notional.toString(), 6);
    await mockUSDC.mint(buyer.address, notionalAmount);
    await mockUSDC.mint(seller.address, notionalAmount);
    console.log(`✅ Minted ${taskArgs.notional} USDC to buyer and seller`);

    // Approve engine to spend USDC
    await mockUSDC.connect(buyer).approve(await cdsSwapEngine.getAddress(), notionalAmount);
    await mockUSDC.connect(seller).approve(await cdsSwapEngine.getAddress(), notionalAmount);
    console.log("✅ Approvals granted to engine");

    // Step 4: Create quote using pricing provider
    console.log("\n📊 Generating quote using pricing provider...");
    const provider = makePricingProvider();
    const providerType = process.env.PRICING_PROVIDER || "stub";
    const bankMode = process.env.BANK_DATA_MODE || "off";
    console.log(`🔧 Provider: ${providerType}, Bank Mode: ${bankMode}`);
    
    const portfolioId = keccak256(toUtf8Bytes(taskArgs.obligor));
    const features = {
      "industry": "technology",
      "region": "us",
      "size": "large",
      "rating": "bbb"
    };
    
    const quote = await provider.price({
      portfolioId,
      tenorDays: taskArgs.tenor,
      asOf: taskArgs.asof,
      notional: BigInt(taskArgs.notional),
      features,
      fixedSpreadBps: taskArgs.fixedSpread,
      modelId: "baseline-v0"
    });
    
    console.log(`✅ Quote generated: ${quote.fairSpreadBps}bps fair, ${quote.correlationBps}bps correlation`);

    // Step 5: Propose swap
    console.log("\n📝 Proposing swap...");
    const swapParams = createSwapParams(taskArgs, buyer.address, seller.address, ethers);
    const proposeTx = await cdsSwapEngine.proposeSwap(swapParams);
    const proposeReceipt = await proposeTx.wait();
    
    const proposeEvent = proposeReceipt.logs.find((log: any) => 
      log.fragment?.name === "SwapProposed"
    );
    const swapId = proposeEvent.args.swapId;
    console.log(`✅ Swap proposed: ${swapId}`);

    // Step 6: Activate swap
    console.log("\n⚡ Activating swap...");
    const activateTx = await cdsSwapEngine.activateSwap(swapId);
    await activateTx.wait();
    console.log("✅ Swap activated");

    // Step 7: Calculate elapsed days
    const elapsedDays = taskArgs.elapsedDays || Math.floor(taskArgs.tenor / 2);
    console.log(`\n⏰ Using elapsed days: ${elapsedDays} (out of ${taskArgs.tenor})`);

    // Step 8: Capture initial balances
    console.log("\n💰 Capturing initial balances...");
    const buyerBalanceBefore = await mockUSDC.balanceOf(buyer.address);
    const sellerBalanceBefore = await mockUSDC.balanceOf(seller.address);
    console.log(`📊 Buyer balance: ${ethers.formatUnits(buyerBalanceBefore, 6)} USDC`);
    console.log(`📊 Seller balance: ${ethers.formatUnits(sellerBalanceBefore, 6)} USDC`);

    // Step 9: Settle in ACCOUNTING mode
    console.log("\n📊 Settling in ACCOUNTING mode...");
    await cdsSwapEngine.setSettlementMode(0); // ACCOUNTING mode
    
    const settleAccountingTx = await cdsSwapEngine.settleSwap(swapId, quote, elapsedDays, taskArgs.tenor);
    const settleAccountingReceipt = await settleAccountingTx.wait();
    
    const settleAccountingEvent = settleAccountingReceipt.logs.find((log: any) => 
      log.fragment?.name === "SettlementExecuted"
    );
    const pnlSmallest = settleAccountingEvent.args.pnlSmallest;
    const gasAccounting = settleAccountingReceipt.gasUsed;
    
    console.log(`✅ ACCOUNTING settlement: PnL = ${pnlSmallest}, Gas = ${gasAccounting}`);

    // Capture balances after ACCOUNTING
    const buyerBalanceAfterAccounting = await mockUSDC.balanceOf(buyer.address);
    const sellerBalanceAfterAccounting = await mockUSDC.balanceOf(seller.address);
    console.log(`📊 Buyer balance (ACCOUNTING): ${ethers.formatUnits(buyerBalanceAfterAccounting, 6)} USDC`);
    console.log(`📊 Seller balance (ACCOUNTING): ${ethers.formatUnits(sellerBalanceAfterAccounting, 6)} USDC`);

    // Step 10: Settle in TRANSFERS mode
    console.log("\n💸 Settling in TRANSFERS mode...");
    await cdsSwapEngine.setSettlementMode(1); // TRANSFERS mode
    
    const settleTransfersTx = await cdsSwapEngine.settleSwap(swapId, quote, elapsedDays, taskArgs.tenor);
    const settleTransfersReceipt = await settleTransfersTx.wait();
    
    const settleTransfersEvent = settleTransfersReceipt.logs.find((log: any) => 
      log.fragment?.name === "SettlementExecuted"
    );
    const gasTransfers = settleTransfersReceipt.gasUsed;
    
    console.log(`✅ TRANSFERS settlement: Gas = ${gasTransfers}`);

    // Capture balances after TRANSFERS
    const buyerBalanceAfterTransfers = await mockUSDC.balanceOf(buyer.address);
    const sellerBalanceAfterTransfers = await mockUSDC.balanceOf(seller.address);
    console.log(`📊 Buyer balance (TRANSFERS): ${ethers.formatUnits(buyerBalanceAfterTransfers, 6)} USDC`);
    console.log(`📊 Seller balance (TRANSFERS): ${ethers.formatUnits(sellerBalanceAfterTransfers, 6)} USDC`);

    // Step 11: Verify results
    console.log("\n🔍 Verifying results...");
    const swapStatus = await cdsSwapEngine.getSwapStatus(swapId);
    console.log(`📊 Swap status: ${swapStatus === 2 ? "Settled" : "Unknown"}`);

    // Step 12: Output summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 Settlement Demo Results");
    console.log("=".repeat(60));
    console.log(`Swap ID: ${swapId}`);
    console.log(`Fixed Spread: ${taskArgs.fixedSpread} bps`);
    console.log(`Fair Spread: ${quote.fairSpreadBps} bps`);
    console.log(`PnL: ${pnlSmallest}`);
    console.log(`ACCOUNTING Gas: ${gasAccounting}`);
    console.log(`TRANSFERS Gas: ${gasTransfers}`);
    console.log(`ACCOUNTING Balance Change: ${buyerBalanceAfterAccounting - buyerBalanceBefore === 0n ? "None" : "ERROR"}`);
    console.log(`TRANSFERS Balance Change: ${buyerBalanceAfterTransfers - buyerBalanceAfterAccounting}`);
    console.log("=".repeat(60));

    // Step 13: Save demo output
    const demoOutput = {
      swapId,
      mode1: "ACCOUNTING",
      mode2: "TRANSFERS",
      pnlSmallest: pnlSmallest.toString(),
      balances: {
        before: {
          buyer: buyerBalanceBefore.toString(),
          seller: sellerBalanceBefore.toString()
        },
        afterAccounting: {
          buyer: buyerBalanceAfterAccounting.toString(),
          seller: sellerBalanceAfterAccounting.toString()
        },
        afterTransfers: {
          buyer: buyerBalanceAfterTransfers.toString(),
          seller: sellerBalanceAfterTransfers.toString()
        }
      },
      gas: {
        settleAccounting: gasAccounting.toString(),
        settleTransfers: gasTransfers.toString()
      }
    };

    // Ensure output directory exists
    const outputPath = taskArgs.outputPath || "dist/demo/demo_settlement.json";
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await hre.fs.writeFile(outputPath, JSON.stringify(demoOutput, null, 2));
    console.log(`\n💾 Demo output saved to ${outputPath}`);
  });

function createSwapParams(params: DemoParams, buyer: string, seller: string, ethers: any) {
  const { keccak256, toUtf8Bytes } = ethers;
  const startTime = params.asof + 3600; // 1 hour from asof
  const maturityTime = startTime + (params.tenor * 24 * 3600); // tenor days from start
  
  // Use smaller values for demo to avoid uint64 overflow
  const demoStartTime = Math.floor(startTime / 1000) * 1000; // Round down to nearest 1000
  const demoMaturityTime = demoStartTime + (params.tenor * 24 * 3600); // tenor days from start
  
  console.log(`⏰ Demo times: start=${demoStartTime}, maturity=${demoMaturityTime}`);

  return {
    portfolioId: keccak256(toUtf8Bytes(params.obligor)),
    protectionBuyer: {
      counterparty: buyer,
      notional: ethers.parseUnits(params.notional.toString(), 6), // USDC has 6 decimals
      spreadBps: params.fixedSpread,
      start: demoStartTime,
      maturity: demoMaturityTime,
    },
    protectionSeller: {
      counterparty: seller,
      notional: ethers.parseUnits(params.notional.toString(), 6),
      spreadBps: params.fixedSpread,
      start: demoStartTime,
      maturity: demoMaturityTime,
    },
    correlationBps: 7000, // 70%
  };
}
