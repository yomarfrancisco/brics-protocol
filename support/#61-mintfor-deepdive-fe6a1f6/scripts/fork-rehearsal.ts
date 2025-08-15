import { ethers } from "hardhat";
import * as fs from "fs";

interface RehearsalResult {
  network: string;
  blockTag: string;
  txs: Array<{ name: string; hash: string }>;
  events: Array<{ name: string; args: any }>;
  summary: {
    totalIssued: string;
    navAtStrike: string;
    carriedOver: string;
  };
}

async function main() {
  console.log("🎭 Starting fork rehearsal...");

  // Load deployed addresses
  const addresses = JSON.parse(fs.readFileSync('deployment/localhost.addresses.json', 'utf8'));
  
  // Get current block for audit trail
  const block = await ethers.provider.getBlock("latest");
  const blockTag = block?.number?.toString() || "unknown";

  const result: RehearsalResult = {
    network: "localhost-fork",
    blockTag,
    txs: [],
    events: [],
    summary: {
      totalIssued: "0",
      navAtStrike: "0",
      carriedOver: "0"
    }
  };

  // Get contracts
  const ic = await ethers.getContractAt("IssuanceControllerV3", addresses.IssuanceControllerV3);
  const token = await ethers.getContractAt("BRICSToken", addresses.BRICSToken);
  const [deployer, user] = await ethers.getSigners();

  console.log("📝 Step 1: Mint tiny amount (5 BRICS)");
  
  // Mint 5 BRICS
  const mintAmount = ethers.parseUnits("5", 6); // 5 USDC
  const sovereignCode = ethers.encodeBytes32String("ZA");
  
  const mintTx = await ic.connect(deployer).mintFor(sovereignCode, user.address, mintAmount);
  const mintReceipt = await mintTx.wait();
  
  result.txs.push({ name: "mintFor", hash: mintTx.hash });
  
  // Capture mint events
  for (const log of mintReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }

  console.log("📝 Step 2: Open NAV window");
  
  // Open NAV window (close ≥ now + 2 days)
  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const closeTime = now + 3 * 24 * 3600; // 3 days
  
  const openTx = await ic.connect(deployer).openNavWindow(closeTime);
  const openReceipt = await openTx.wait();
  
  result.txs.push({ name: "openNavWindow", hash: openTx.hash });
  
  // Capture open events
  for (const log of openReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }

  console.log("📝 Step 3: Queue tiny redemption (2 BRICS)");
  
  // Queue redemption for 2 BRICS
  const redeemAmount = ethers.parseEther("2"); // 2 BRICS tokens
  
  const queueTx = await ic.connect(deployer).requestRedeemOnBehalf(user.address, redeemAmount);
  const queueReceipt = await queueTx.wait();
  
  result.txs.push({ name: "requestRedeemOnBehalf", hash: queueTx.hash });
  
  // Capture queue events
  for (const log of queueReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }

  console.log("📝 Step 4: Close window and strike");
  
  // Fast forward past close time
  await ethers.provider.send("evm_setNextBlockTimestamp", [closeTime + 1]);
  await ethers.provider.send("evm_mine", []);
  
  // Close window
  const closeTx = await ic.connect(deployer).closeNavWindow();
  const closeReceipt = await closeTx.wait();
  
  result.txs.push({ name: "closeNavWindow", hash: closeTx.hash });
  
  // Capture close events
  for (const log of closeReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }
  
  // Strike NAV
  const strikeTx = await ic.connect(deployer).strikeRedemption();
  const strikeReceipt = await strikeTx.wait();
  
  result.txs.push({ name: "strikeRedemption", hash: strikeTx.hash });
  
  // Capture strike events
  for (const log of strikeReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }

  console.log("📝 Step 5: Fast forward to T+5d and settle");
  
  // Fast forward to T+5d
  const settleTime = closeTime + 5 * 24 * 3600 + 1;
  await ethers.provider.send("evm_setNextBlockTimestamp", [settleTime]);
  await ethers.provider.send("evm_mine", []);
  
  // Get claim ID for settlement (assuming claim was minted)
  const claimId = 1; // First claim in the system
  
  // Settle claim
  const settleTx = await ic.connect(deployer).settleClaim(1, claimId, user.address);
  const settleReceipt = await settleTx.wait();
  
  result.txs.push({ name: "settleClaim", hash: settleTx.hash });
  
  // Capture settle events
  for (const log of settleReceipt?.logs || []) {
    try {
      const parsed = ic.interface.parseLog(log);
      result.events.push({ name: parsed?.name || "Unknown", args: parsed?.args || {} });
    } catch (e) {
      // Skip unparseable logs
    }
  }

  // Collect summary data
  const totalIssued = await ic.totalIssued();
  
  // Get NAV at strike for window 1
  let navAtStrike = BigInt(0);
  try {
    const window = await ic.navWindows(1);
    navAtStrike = window.navRayAtStrike;
  } catch (e) {
    console.log("⚠️  Could not get NAV at strike:", e);
  }
  
  // Get carryover amount
  let carriedOver = BigInt(0);
  try {
    carriedOver = await ic.claimToRemainingUSDC(claimId);
  } catch (e) {
    console.log("⚠️  Could not get carryover amount:", e);
  }

  result.summary = {
    totalIssued: totalIssued.toString(),
    navAtStrike: navAtStrike.toString(),
    carriedOver: carriedOver.toString()
  };

  // Write results
  fs.mkdirSync('audit', { recursive: true });
  fs.writeFileSync('audit/fork-rehearsal.json', JSON.stringify(result, null, 2));
  
  console.log("✅ Fork rehearsal complete!");
  console.log(`📊 Summary: ${result.txs.length} transactions, ${result.events.length} events`);
  console.log(`📄 Results saved to audit/fork-rehearsal.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
