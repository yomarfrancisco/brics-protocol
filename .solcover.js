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

module.exports = {
  skipFiles: heavy
    ? (shard === "a" ? shardB : shardA) // include the other half per shard
    : fastSkips,
  istanbulReporter: ["text-summary", "lcov"],
  configureYulOptimizer: false,
};
