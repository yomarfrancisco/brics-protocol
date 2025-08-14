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
  "settlement/SettlementMath.sol",
  "redemption/RedemptionQueue.sol",
  "redemption/RedemptionQueueView.sol",
  "swap/CdsSwapEngine.sol",
  "swap/CdsSwapRegistry.sol",
  "RedemptionClaim.sol",
  "SovereignClaimSBT.sol",
  "SovereignClaimToken.sol",
  "TrancheManagerV2.sol",
  "MezzVault4626.sol",
  "MezzanineVault.sol",
  "IssuanceControllerV4.sol",
  "IssuanceControllerV3.sol",
];

module.exports = {
  skipFiles: heavy
    ? [...(shard === "a" ? shardB : shardA), ...coverageSkips] // include the other half per shard + coverage skips
    : [...fastSkips, ...coverageSkips],
  istanbulReporter: ["text-summary", "lcov"],
  configureYulOptimizer: false,
};
