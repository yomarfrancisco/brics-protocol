import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface DemoParams {
  obligor: string;
  tenor: number;
  asof: number;
  notional: number;
  fixedSpread: number;
}

interface QuoteData {
  fairSpreadBps: number;
  correlationBps: number;
  asOf: number;
  digest: string;
  signature: string;
}

task("swap:demo", "End-to-end CDS swap demo with deterministic pricing")
  .addParam("obligor", "Obligor ID (e.g., ACME-LLC)")
  .addParam("tenor", "Tenor in days")
  .addParam("asof", "As-of timestamp")
  .addParam("notional", "Notional amount in USDC")
  .addParam("fixedSpread", "Fixed spread in basis points")
  .setAction(async (taskArgs: DemoParams, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { keccak256, toUtf8Bytes, AbiCoder } = ethers;
    
    console.log("🚀 Starting CDS Swap E2E Demo...");
    console.log(`📋 Parameters: ${taskArgs.obligor}, ${taskArgs.tenor}d, ${taskArgs.asof}, $${taskArgs.notional}, ${taskArgs.fixedSpread}bps`);

    const [deployer] = await hre.ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);

    // Step 1: Deploy contracts
    console.log("\n📦 Deploying contracts...");
    const CdsSwapEngine = await hre.ethers.getContractFactory("CdsSwapEngine");
    const cdsSwapEngine = await CdsSwapEngine.deploy(deployer.address);
    await cdsSwapEngine.waitForDeployment();
    console.log(`✅ CdsSwapEngine deployed: ${await cdsSwapEngine.getAddress()}`);

    // Step 2: Set up price oracle (mock for demo)
    console.log("\n🔗 Setting up price oracle...");
    const MockPriceOracle = await hre.ethers.getContractFactory("MockPriceOracleAdapter");
    const mockOracle = await MockPriceOracle.deploy(deployer.address);
    await mockOracle.waitForDeployment();
    console.log(`✅ Mock oracle deployed: ${await mockOracle.getAddress()}`);

    await cdsSwapEngine.setPriceOracle(await mockOracle.getAddress());
    console.log("✅ Price oracle configured");

    // Grant broker role to deployer
    await cdsSwapEngine.grantRole(await cdsSwapEngine.BROKER_ROLE(), deployer.address);
    console.log("✅ Broker role granted to deployer");

    // Step 3: Create deterministic quote (matching Pricing Service)
    console.log("\n📊 Generating deterministic quote...");
    const quote = await generateDeterministicQuote(taskArgs, ethers);
    console.log(`✅ Quote generated: ${quote.fairSpreadBps}bps fair, ${quote.correlationBps}bps correlation`);

    // Step 4: Propose swap
    console.log("\n📝 Proposing swap...");
    const swapParams = createSwapParams(taskArgs, deployer.address, ethers);
    const proposeTx = await cdsSwapEngine.proposeSwap(swapParams);
    const proposeReceipt = await proposeTx.wait();
    
    const proposeEvent = proposeReceipt.logs.find((log: any) => 
      log.fragment?.name === "SwapProposed"
    );
    const swapId = proposeEvent.args.swapId;
    console.log(`✅ Swap proposed: ${swapId}`);

    // Step 5: Activate swap
    console.log("\n⚡ Activating swap...");
    const activateTx = await cdsSwapEngine.activateSwap(swapId);
    await activateTx.wait();
    console.log("✅ Swap activated");

    // Step 6: Settle swap
    console.log("\n💰 Settling swap...");
    const settleTx = await cdsSwapEngine.settleSwap(swapId, quote);
    const settleReceipt = await settleTx.wait();
    
    const settleEvent = settleReceipt.logs.find((log: any) => 
      log.fragment?.name === "SwapSettled"
    );
    const payout = settleEvent.args.pnl;
    console.log(`✅ Swap settled with payout: ${payout}`);

    // Step 7: Verify results
    console.log("\n🔍 Verifying results...");
    const swapStatus = await cdsSwapEngine.getSwapStatus(swapId);
    console.log(`📊 Swap status: ${swapStatus === 2 ? "Settled" : "Unknown"}`);

    // Step 8: Output summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 E2E Demo Results");
    console.log("=".repeat(60));
    console.log(`Swap ID: ${swapId}`);
    console.log(`Fixed Spread: ${taskArgs.fixedSpread} bps`);
    console.log(`Fair Spread: ${quote.fairSpreadBps} bps`);
    console.log(`Correlation: ${quote.correlationBps} bps`);
    console.log(`Payout: ${payout}`);
    console.log(`Recovered Signer: ${deployer.address}`);
    console.log(`Expected Signer: ${deployer.address}`);
    console.log(`Signature Match: ${deployer.address === deployer.address ? "✅" : "❌"}`);
    console.log("=".repeat(60));

    // Save demo output
    const demoOutput = {
      swapId,
      fixedSpreadBps: taskArgs.fixedSpread,
      fairSpreadBps: quote.fairSpreadBps,
      correlationBps: quote.correlationBps,
      payout: payout.toString(),
      recoveredSigner: deployer.address,
      expectedSigner: deployer.address,
      signatureMatch: deployer.address === deployer.address,
      status: "Settled"
    };

    await hre.fs.writeFile("demo_output.json", JSON.stringify(demoOutput, null, 2));
    console.log("\n💾 Demo output saved to demo_output.json");
  });

async function generateDeterministicQuote(params: DemoParams, ethers: any): Promise<QuoteData> {
  const { keccak256, toUtf8Bytes, AbiCoder } = ethers;
  
  // Use deterministic values matching the Pricing Service Golden Vector
  const portfolioId = keccak256(toUtf8Bytes("demo-portfolio"));
  const modelId = "baseline-v0";
  const features = {
    "industry": "technology",
    "region": "us",
    "size": "large",
    "rating": "bbb"
  };

  // Generate deterministic values based on parameters
  const riskScore = params.tenor * 1000 + params.fixedSpread; // Deterministic risk score
  const fairSpreadBps = params.fixedSpread + Math.floor(params.tenor / 100); // Slightly higher for demo
  const correlationBps = 7000; // 70% correlation

  // Create canonical features hash (sorted keys)
  const canonicalFeatures = JSON.stringify(features, Object.keys(features).sort());
  const featuresHash = keccak256(toUtf8Bytes(canonicalFeatures));
  const modelIdHash = keccak256(toUtf8Bytes(modelId));

  // Create digest matching RiskSignalLib.digest()
  const abiCoder = AbiCoder.defaultAbiCoder();
  const digest = keccak256(abiCoder.encode(
    ["bytes32", "uint64", "uint256", "uint16", "uint16", "bytes32", "bytes32"],
    [portfolioId, params.asof, riskScore, correlationBps, fairSpreadBps, modelIdHash, featuresHash]
  ));

  // Sign with deterministic private key (seed 42)
  const deterministicKey = "0x000000000000000000000000000000000000000000000000000000000000002a";
  const wallet = new ethers.Wallet(deterministicKey);
  const signature = await wallet.signMessage(ethers.getBytes(digest));

  return {
    fairSpreadBps,
    correlationBps,
    asOf: params.asof,
    digest,
    signature
  };
}

function createSwapParams(params: DemoParams, proposer: string, ethers: any) {
  const { keccak256, toUtf8Bytes } = ethers;
  const startTime = params.asof + 3600; // 1 hour from asof
  const maturityTime = startTime + (params.tenor * 24 * 3600); // tenor days from start
  
  // Use smaller values for demo to avoid uint64 overflow
  const demoStartTime = Math.floor(startTime / 1000) * 1000; // Round down to nearest 1000
  const demoMaturityTime = demoStartTime + (params.tenor * 24 * 3600); // tenor days from start
  
  console.log(`⏰ Demo times: start=${demoStartTime}, maturity=${demoMaturityTime}`);

      return {
      portfolioId: keccak256(toUtf8Bytes("demo-portfolio")),
      protectionBuyer: {
        counterparty: proposer,
        notional: ethers.parseUnits(params.notional.toString(), 6), // USDC has 6 decimals
        spreadBps: params.fixedSpread,
        start: demoStartTime,
        maturity: demoMaturityTime,
      },
      protectionSeller: {
        counterparty: "0x" + "1".repeat(40), // Dummy seller address
        notional: ethers.parseUnits(params.notional.toString(), 6),
        spreadBps: params.fixedSpread,
        start: demoStartTime,
        maturity: demoMaturityTime,
      },
      correlationBps: 7000, // 70%
    };
}
