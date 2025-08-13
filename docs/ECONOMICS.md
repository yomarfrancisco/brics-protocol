# Economics Parameters

This document describes the economic parameters and fee structures used in the BRICS protocol, including how to configure them and monitor gas usage.

## Overview

The BRICS protocol uses a configurable fee structure and economic parameters that can be adjusted by governance to optimize protocol performance and revenue generation.

## Economic Parameters

### Core Parameters

All economic parameters are stored in the `ConfigRegistry` contract and can be modified by `GOV_ROLE` holders.

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `tradeFeeBps` | 50 bps (0.5%) | 0-20,000 bps | Fee charged on instant redemption trades |
| `pmmCurveK_bps` | 1,000 bps (10%) | 0-20,000 bps | PMM curve parameter K (volatility) |
| `pmmTheta_bps` | 500 bps (5%) | 0-20,000 bps | PMM curve parameter theta (decay) |
| `maxBoundBps` | 5,000 bps (50%) | 0-20,000 bps | Maximum price bound sanity check |
| `issuanceCapBufferBps` | 500 bps (5%) | 0-10,000 bps | Issuance cap buffer percentage |

### Parameter Details

#### Trade Fee (`tradeFeeBps`)
- **Purpose**: Revenue generation from instant redemption operations
- **Calculation**: Applied as a percentage of the redemption amount
- **Example**: 50 bps = 0.5% fee on $1,000 redemption = $5 fee
- **Governance**: Can be adjusted based on market conditions and revenue targets

#### PMM Curve Parameters
- **`pmmCurveK_bps`**: Controls the curvature of the PMM bonding curve
  - Higher values = more volatile pricing
  - Lower values = more stable pricing
- **`pmmTheta_bps`**: Controls the decay rate of the PMM curve
  - Higher values = faster price adjustment
  - Lower values = slower price adjustment

#### Maximum Bound (`maxBoundBps`)
- **Purpose**: Sanity check to prevent extreme price movements
- **Usage**: Used as an upper limit for emergency level bounds
- **Safety**: Prevents protocol from accepting unreasonable prices

#### Issuance Cap Buffer (`issuanceCapBufferBps`)
- **Purpose**: Safety buffer for issuance limits based on sovereign capacity
- **Calculation**: `maxIssuable = capacity * (10000 - bufferBps) / 10000`
- **Example 1**: 500 bps buffer with 1M USDC capacity = 950k USDC max issuable
- **Example 2**: 1000 bps buffer with 2M USDC capacity = 1.8M USDC max issuable
- **Safety**: Ensures protocol maintains reserves below oracle-reported capacity

## Reading Economic Parameters

### On-Chain View Function

Use the `getEconomics()` view function to read all economic parameters at once:

```solidity
function getEconomics() external view returns (
    uint256 tradeFeeBps_,
    uint256 pmmCurveK_bps_,
    uint256 pmmTheta_bps_,
    uint256 maxBoundBps_
);
```

### Individual Parameter Access

Each parameter can also be read individually:

```solidity
uint256 tradeFee = configRegistry.tradeFeeBps();
uint256 pmmK = configRegistry.pmmCurveK_bps();
uint256 pmmTheta = configRegistry.pmmTheta_bps();
uint256 maxBound = configRegistry.maxBoundBps();
```

### Off-Chain Integration

The Risk API provides signed endpoints for reading economic parameters:

```bash
# Get current economics parameters
curl "http://localhost:8000/api/v1/economics/parameters"
```

## Tranche APY Surface (Read-Only)

### Overview

The tranche APY system provides risk-adjusted yields based on base APY and risk adjustments from oracle feeds.

### APY Calculation

The effective APY is calculated using the following formula:

```
effectiveApyBps = max(0, baseApyBps - riskAdjBps)
```

Where:
- `baseApyBps`: Base annual percentage yield in basis points
- `riskAdjBps`: Risk adjustment in basis points (subtracted from base)
- `maxApyBps`: Maximum allowed APY in basis points (from ConfigRegistry)

The result is clamped to the range `[0, maxApyBps]`.

### Example Calculations

**Example 1**: Base 800 bps, risk 200 bps, max 1000 bps
- Effective APY = max(0, 800 - 200) = 600 bps (6.0%)

**Example 2**: Base 1200 bps, risk 300 bps, max 1000 bps  
- Effective APY = max(0, 1200 - 300) = 900 bps (9.0%)
- Clamped to max: 1000 bps (10.0%)

**Example 3**: Base 500 bps, risk 600 bps, max 1000 bps
- Effective APY = max(0, 500 - 600) = 0 bps (0.0%)

### Oracle Integration

Tranche APY values are sourced from `ITrancheRiskOracle`:
```solidity
function latestTrancheRisk(uint256 trancheId) external view returns (
    uint16 baseApyBps, 
    uint16 riskAdjBps, 
    uint64 asOf
);
```

### Risk Oracle Adapter

The `TrancheRiskOracleAdapter` provides staleness guards and governance controls:

```solidity
function latestRisk(uint256 trancheId) external view returns (uint16 riskAdjBps, uint64 ts);
```

**Staleness Protection**: The adapter enforces a maximum age for risk data:
- Reverts with `StaleRiskData` error if `(block.timestamp - ts) > maxAge`
- Configurable max age via `setMaxAge()` (governance only)
- Default: 1 hour (3600 seconds)

**Governance Controls**:
- `setOracle(address)`: Update oracle address
- `setMaxAge(uint64)`: Update maximum age for staleness checks
- Both functions emit events for transparency

### Adapter Integration Flow

```
TrancheReadFacade
├── Base APY: from ITrancheRiskOracle
├── Risk Adjustment: from TrancheRiskOracleAdapter (if enabled)
│   ├── Staleness check: (block.timestamp - ts) ≤ maxAge
│   └── Governance: oracle address + max age configurable
└── Effective APY: TrancheMath.effectiveApyBps()
```

### Per-Tranche Risk Override

The `ConfigRegistry` provides per-tranche risk adjustment overrides that take precedence over oracle/adapter values:

```solidity
function trancheRiskAdjOverrideBps(uint256 trancheId) external view returns (uint16);
function setTrancheRiskAdjOverrideBps(uint256 trancheId, uint16 newVal) external onlyRole(GOV_ROLE);
```

**Override Behavior**:
- **Precedence**: Override > Adapter > Oracle (when override > 0)
- **Bounds**: 0 ≤ override ≤ maxBoundBps (governance enforced)
- **Staleness Bypass**: When override > 0, stale oracle data is ignored
- **Governance**: Only `GOV_ROLE` can set overrides

**Use Cases**:
- **Emergency adjustments**: Override risk for specific tranches during market stress
- **Manual corrections**: Override incorrect oracle data while fixing the source
- **Tranche-specific policies**: Apply different risk adjustments per tranche

**Examples**:
- **Lower override**: Set override = 100 bps when oracle reports 200 bps → higher APY
- **Higher override**: Set override = 400 bps when oracle reports 200 bps → lower APY
- **Emergency zero**: Set override = 0 to disable risk adjustment entirely

## Setting Economic Parameters

### Governance Process

1. **Proposal**: Governance proposes parameter changes
2. **Voting**: DAO votes on the proposal
3. **Execution**: `GOV_ROLE` holder executes the change
4. **Verification**: Parameters are verified on-chain

### Parameter Setters

All setters include bounds checking and emit events:

```solidity
function setTradeFeeBps(uint256 v) external onlyRole(GOV_ROLE);
function setPmmCurveK_bps(uint256 v) external onlyRole(GOV_ROLE);
function setPmmTheta_bps(uint256 v) external onlyRole(GOV_ROLE);
function setMaxBoundBps(uint256 v) external onlyRole(GOV_ROLE);
```

### Bounds Validation

All parameters are validated to prevent unsafe values:

- **Maximum**: 20,000 bps (200%)
- **Minimum**: 0 bps (0%)
- **Events**: All changes emit `ParamSet` events with old/new values

## Gas Optimization

### Gas Budgets

The protocol maintains gas budgets for key functions:

| Contract | Function | Budget | Purpose |
|----------|----------|--------|---------|
| `InstantLane` | `instantRedeem` | 200,000 gas | Core redemption function |
| `InstantLane` | `instantRedeemFor` | 200,000 gas | Proxy redemption function |
| `InstantLane` | `preTradeCheck` | 5,000 gas | Price validation |
| `CdsSwapEngine` | `settleSwap` | 150,000 gas | Swap settlement |
| `CdsSwapEngine` | `proposeSwap` | 100,000 gas | Swap proposal |
| `ConfigRegistry` | `setTradeFeeBps` | 30,000 gas | Parameter updates |
| `Treasury` | `pay` | 50,000 gas | Treasury operations |

### Gas Monitoring

#### Local Gas Reports

Generate gas reports locally:

```bash
# Generate gas report for bounds tests
yarn gas:bounds

# Generate gas report for core functions
yarn gas:core

# Check gas budgets
yarn gas:budget
```

#### CI Gas Reports

Gas reports are automatically generated in CI and uploaded as artifacts:

- **Location**: `gas-report.txt` in CI artifacts
- **Frequency**: Generated on every test run
- **Retention**: 14 days

#### Gas Budget Enforcement

Gas budgets can be enforced in CI:

```bash
# Warning mode (default)
GAS_BUDGET_ENFORCE=false yarn gas:budget

# Enforcement mode
GAS_BUDGET_ENFORCE=true yarn gas:budget
```

## Economic Parameter Interplay

### Price Bounds Integration

Economic parameters interact with emergency level price bounds:

1. **Normal Operation**: Parameters used for fee calculation and PMM pricing
2. **Emergency Levels**: `maxBoundBps` used as sanity check for bounds
3. **Circuit Breakers**: Parameters can be adjusted during emergencies

### Fee Revenue Flow

```
User Redemption → Trade Fee Applied → Treasury Receives Fee → Protocol Revenue
```

### PMM Integration

PMM parameters affect pricing in the instant lane:

1. **Curve K**: Determines price sensitivity to trade size
2. **Theta**: Controls how quickly prices adjust
3. **Bounds**: `maxBoundBps` prevents extreme PMM prices

## Monitoring and Analytics

### Key Metrics

- **Fee Revenue**: Track `tradeFeeBps` revenue over time
- **Gas Usage**: Monitor function gas costs vs budgets
- **Parameter Changes**: Audit trail of all parameter updates
- **PMM Performance**: Analyze PMM curve behavior

### Event Logging

All parameter changes emit events for monitoring:

```solidity
event ParamSet(bytes32 key, uint256 value);
```

### Off-Chain Monitoring

Use the Risk API for real-time parameter monitoring:

```bash
# Get current economics state
curl "http://localhost:8000/api/v1/economics/state"

# Get parameter change history
curl "http://localhost:8000/api/v1/economics/history"
```

## Best Practices

### Parameter Management

1. **Gradual Changes**: Make small, incremental parameter adjustments
2. **Testing**: Test parameter changes on staging before mainnet
3. **Monitoring**: Monitor protocol behavior after parameter changes
4. **Documentation**: Document rationale for parameter changes

### Gas Optimization

1. **Regular Monitoring**: Check gas usage regularly
2. **Budget Updates**: Adjust gas budgets as needed
3. **Optimization**: Optimize functions that exceed budgets
4. **Testing**: Include gas tests in CI pipeline

### Emergency Procedures

1. **Quick Response**: Parameters can be adjusted quickly in emergencies
2. **Rollback Plan**: Have rollback procedures ready
3. **Communication**: Communicate parameter changes to users
4. **Monitoring**: Monitor impact of emergency parameter changes

## Future Enhancements

- **Dynamic Fees**: Automatic fee adjustment based on market conditions
- **Advanced PMM**: More sophisticated PMM curve parameters
- **Gas Optimization**: Further gas optimization for high-frequency operations
- **Analytics Dashboard**: Real-time economics dashboard
- **Automated Monitoring**: Automated alerts for parameter breaches

