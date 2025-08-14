const heavy = !!process.env.COVERAGE_HEAVY;
const shard = process.env.COVERAGE_SHARD || "a";

// light mode skips the heavy hitters to keep CI fast
const fastSkips = [
  "IssuanceControllerV3.sol",
  "NAVOracleV3.sol",
  "MezzanineVault.sol",
  "RedemptionClaim.sol",
  "SovereignClaimToken.sol",
  "malicious/",
  "mocks/",
  "frontend/",
  "offchain/",
  "scripts/",
  "tasks/",
  "deployment/",
  "docs/",
];

// optional sharding for nightly heavy runs (split your largest files)
const shardA = [
  "ClaimRegistry.sol",
  "ConfigRegistry.sol",
];
const shardB = [
  "PreTrancheBuffer.sol",
  "Treasury.sol",
];

// Additional skips for coverage instrumentation issues
const coverageSkips = [
  "IssuanceControllerV4.sol", // deep stack under coverage
  "IssuanceControllerV3.sol", // deep stack under coverage
  "MezzanineVault.sol", // deep stack under coverage
  "TrancheManagerV2.sol", // deep stack under coverage
  // "settlement/SettlementMath.sol", // ✅ Can be unskipped - no YulException
  // "redemption/RedemptionQueue.sol", // ✅ Can be unskipped - no YulException
  // "redemption/RedemptionQueueView.sol", // ✅ Can be unskipped - no YulException
  // "swap/CdsSwapEngine.sol", // ✅ Can be unskipped - no YulException
  // "swap/CdsSwapRegistry.sol", // ✅ Can be unskipped - no YulException
  // "RedemptionClaim.sol", // ✅ Can be unskipped - no YulException
  // "SovereignClaimSBT.sol", // ✅ Can be unskipped - no YulException
  // "SovereignClaimToken.sol", // ✅ Can be unskipped - no YulException
  // "MezzVault4626.sol", // ✅ Can be unskipped - no YulException
];

module.exports = {
  skipFiles: heavy
    ? [...(shard === "a" ? shardB : shardA), ...coverageSkips] // include the other half per shard + coverage skips
    : [...fastSkips, ...coverageSkips],
  istanbulReporter: ["text-summary", "lcov"],
  configureYulOptimizer: false,
};
