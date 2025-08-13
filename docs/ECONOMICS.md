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

### Per-Tranche Risk Confidence Bands

The `ConfigRegistry` provides per-tranche risk confidence bands that clamp risk adjustments to safe ranges:

```solidity
function trancheRiskFloorBps(uint256 trancheId) external view returns (uint16);
function trancheRiskCeilBps(uint256 trancheId) external view returns (uint16);
function setTrancheRiskBands(uint256 trancheId, uint16 floorBps, uint16 ceilBps) external onlyRole(GOV_ROLE);
```

**Band Behavior**:
- **Precedence**: Override → Bands → APY clamp (when bands enabled)
- **Bounds**: 0 ≤ floor ≤ ceil ≤ maxBoundBps (governance enforced)
- **Enable/Disable**: Set ceil = 0 to disable bands (no clamping)
- **Governance**: Only `GOV_ROLE` can set bands

**Use Cases**:
- **Risk containment**: Prevent extreme risk adjustments during market volatility
- **Stability**: Maintain reasonable APY ranges for investor confidence
- **Emergency limits**: Set narrow bands during crisis periods

**Examples**:
- **Narrow bands**: Set floor = 200 bps, ceil = 400 bps → risk clamped to [2%, 4%]
- **Wide bands**: Set floor = 100 bps, ceil = 800 bps → risk clamped to [1%, 8%]
- **Disable bands**: Set floor = 0, ceil = 0 → no clamping (use oracle/adapter/override)

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

## Telemetry and Observability

### Tranche Telemetry Function

The `TrancheReadFacade` provides a comprehensive telemetry function that returns detailed information about the decision path taken for risk calculations:

```solidity
function viewTrancheTelemetry(uint256 trancheId) external view returns (
    uint16 baseApyBps,           // Base APY from oracle
    uint16 oracleRiskAdjBps,     // Original risk adjustment from oracle
    uint16 overrideRiskAdjBps,   // Override risk adjustment (0 if not set)
    uint16 adapterRiskAdjBps,    // Adapter risk adjustment (0 if not used)
    uint16 finalRiskAdjBps,      // Final risk adjustment after all logic
    uint16 effectiveApyBps,      // Effective APY in basis points
    uint16 maxApyBps,            // Maximum allowed APY
    uint16 floorBps,             // Risk floor from confidence bands
    uint16 ceilBps,              // Risk ceiling from confidence bands
    uint64 asOf,                 // Timestamp when data was last updated
    uint8 telemetryFlags,        // Bit flags indicating decision path
    uint16 rollingAverageBps,    // Rolling average risk adjustment (0 if not used)
    uint16 rollingWindowDays     // Rolling window size in days (0 if disabled)
);
```

### Telemetry Flags

The `telemetryFlags` field uses bit flags to indicate which decision path was taken:

| Flag | Value | Description |
|------|-------|-------------|
| `FLAG_BASE_APY_OVERRIDE_USED` | 0x01 | Base APY override was applied |
| `FLAG_RISK_OVERRIDE_USED` | 0x02 | Risk override was applied |
| `FLAG_ADAPTER_USED` | 0x04 | Risk adapter was used (instead of oracle direct) |
| `FLAG_ORACLE_DIRECT` | 0x08 | Oracle data used directly (no adapter) |
| `FLAG_ROLLING_AVG_ENABLED` | 0x10 | Rolling average is enabled for this tranche |
| `FLAG_ROLLING_AVG_USED` | 0x20 | Rolling average was applied (different from raw value) |
| `FLAG_BANDS_ENABLED` | 0x40 | Risk confidence bands are enabled |
| `FLAG_FLOOR_CLAMPED` | 0x80 | Risk was clamped to floor value |
| `FLAG_CEIL_CLAMPED` | 0x100 | Risk was clamped to ceiling value |

### Decision Path Precedence

The APY calculation follows this precedence order:

1. **Base APY Override**: If `baseApyOverrideBps > 0`, use override value instead of oracle base APY
2. **Risk Override Check**: If `overrideRiskAdjBps > 0`, use override value
3. **Adapter Check**: If adapter enabled and available, use adapter value
4. **Oracle Direct**: Otherwise, use oracle value directly
5. **Rolling Average**: If enabled and no risk override, apply rolling average calculation
6. **Bands Clamping**: Apply confidence band clamping if enabled
7. **APY Clamp**: Apply maximum APY clamp if needed

### Example Usage

```solidity
// Get comprehensive telemetry for tranche 1
(uint16 baseApyBps, uint16 oracleBaseApyBps, uint16 baseApyOverrideBps,
 uint16 oracleRiskAdjBps, uint16 overrideRiskAdjBps, uint16 adapterRiskAdjBps,
 uint16 finalRiskAdjBps, uint16 effectiveApyBps, uint16 maxApyBps,
 uint16 floorBps, uint16 ceilBps, uint64 asOf, uint16 telemetryFlags,
 uint16 rollingAverageBps, uint16 rollingWindowDays) = facade.viewTrancheTelemetry(1);

// Check if base APY override was used
if (telemetryFlags & 0x01 != 0) {
    // Base APY override was applied
}

// Check if risk override was used
if (telemetryFlags & 0x02 != 0) {
    // Risk override was applied
}

// Check if adapter was used
if (telemetryFlags & 0x04 != 0) {
    // Adapter was used
}

// Check if bands were applied
if (telemetryFlags & 0x40 != 0) {
    // Confidence bands were enabled
}
```

### Monitoring Use Cases

1. **Decision Path Analysis**: Understand which risk source is being used
2. **Override Monitoring**: Track when overrides are applied
3. **Band Clamping**: Monitor when risk values are clamped
4. **Adapter Health**: Verify adapter is functioning correctly
5. **Data Freshness**: Check timestamp of last data update
6. **Rolling Average**: Monitor rolling average usage and effectiveness

## Rolling Average Risk Calculation

### Overview

The rolling average risk calculation provides time-weighted averaging of risk adjustment values to smooth out volatility and provide more stable risk assessments.

### Algorithm

The rolling average uses a linear decay weighting system:

1. **Data Collection**: Risk adjustment values are recorded with timestamps
2. **Window Filtering**: Only data points within the configured window are considered
3. **Weight Calculation**: Each data point is weighted by its age using linear decay
4. **Weighted Average**: Final risk adjustment is the weighted average of all valid points

### Weight Calculation

The weight for each data point is calculated as:

```
weight = (maxAge - age) / maxAge * 10000
```

Where:
- `maxAge` = window size in seconds (e.g., 7 days = 604,800 seconds)
- `age` = current time - data point timestamp
- Weight is scaled to 0-10000 for precision

### Governance Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `trancheRollingEnabled` | boolean | Enable/disable rolling average per tranche |
| `trancheRollingWindowDays` | 1-90 days | Window size for rolling average calculation |

### Storage Structure

- **Circular Buffer**: Fixed-size array (30 slots) to avoid unbounded growth
- **Gas Efficiency**: ~100 bytes per data point, ~3KB per tranche for 30-day window
- **Automatic Cleanup**: Old data points are automatically overwritten

### Governance Controls

```solidity
// Enable rolling average for tranche 1 with 7-day window
configRegistry.setTrancheRollingEnabled(1, true);
configRegistry.setTrancheRollingWindow(1, 7);

// Disable rolling average for tranche 2
configRegistry.setTrancheRollingEnabled(2, false);
```

### Data Recording

Risk adjustment points are recorded via governance or keeper functions:

```solidity
// Record a risk adjustment point
configRegistry.recordTrancheRiskPoint(trancheId, riskAdjBps, timestamp);
```

### Example Scenarios

#### Scenario 1: Single Data Point
- Window: 7 days
- Data: 200 bps risk adjustment recorded 1 day ago
- Result: Rolling average = 200 bps (single point)

#### Scenario 2: Multiple Data Points
- Window: 7 days
- Data: 200 bps (6 days ago), 250 bps (3 days ago), 300 bps (1 day ago)
- Result: Weighted average favoring newer data points

#### Scenario 3: Override Precedence
- Override: 150 bps
- Rolling average: 200 bps
- Result: Override takes precedence, rolling average ignored

#### Scenario 4: Bands Clamping
- Rolling average: 500 bps
- Bands: floor 200 bps, ceiling 400 bps
- Result: Final risk = 400 bps (clamped to ceiling)

### Integration with Existing Systems

- **Override Compatibility**: Rolling average is ignored when override is set
- **Adapter Integration**: Works with both oracle direct and adapter paths
- **Bands Integration**: Rolling average is clamped by confidence bands
- **Telemetry Integration**: Full visibility into rolling average usage

### Operational Considerations

1. **Data Recording**: Requires regular recording of risk adjustment points
2. **Window Sizing**: Balance between stability (longer window) and responsiveness (shorter window)
3. **Gas Costs**: Each data point recording costs ~50k gas
4. **Storage Limits**: Maximum 30 data points per tranche
5. **Governance**: Window size and enable/disable controls per tranche

## Per-Tranche Base APY Override

### Overview

The per-tranche base APY override allows governance to directly override the base APY value for specific tranches, providing fine-grained control over tranche yields independent of oracle feeds.

### Purpose

- **Market Adjustments**: Adjust tranche yields to respond to market conditions
- **Competitive Positioning**: Set specific yields for strategic tranches
- **Emergency Controls**: Override oracle values during market stress
- **Testing Support**: Enable controlled testing of different yield scenarios

### Governance Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `trancheBaseApyOverrideBps` | 0-50,000 bps | Base APY override value (0 = no override) |

### Storage Structure

- **Per-Tranche Mapping**: `mapping(uint256 => uint16)` for efficient storage
- **Gas Efficiency**: ~20k gas for setter, ~2k gas for getter
- **Default Value**: 0 (no override) for all tranches

### Governance Controls

```solidity
// Set base APY override for tranche 1 to 12% (1200 bps)
configRegistry.setTrancheBaseApyOverrideBps(1, 1200);

// Disable override for tranche 2
configRegistry.setTrancheBaseApyOverrideBps(2, 0);

// Read current override value
uint16 override = configRegistry.trancheBaseApyOverrideBps(trancheId);
```

### Integration with Existing Systems

- **Precedence**: Base APY override takes precedence over oracle base APY
- **Risk Adjustment**: Override affects base APY only, risk adjustments still apply
- **Telemetry**: Full visibility into override usage via telemetry flags
- **Bands Compatibility**: Works with all existing risk adjustment features

### Example Scenarios

#### Scenario 1: Basic Override
- Oracle base APY: 8% (800 bps)
- Override: 12% (1200 bps)
- Result: Base APY = 12%, effective APY = 12% - risk adjustment

#### Scenario 2: Override with Risk Adjustment
- Oracle base APY: 8% (800 bps)
- Override: 10% (1000 bps)
- Risk adjustment: 2% (200 bps)
- Result: Effective APY = 8% (1000 - 200 bps)

#### Scenario 3: Override with Rolling Average
- Base APY override: 15% (1500 bps)
- Rolling average risk: 3% (300 bps)
- Result: Effective APY = 12% (1500 - 300 bps)

#### Scenario 4: Override with Bands
- Base APY override: 20% (2000 bps)
- Risk adjustment: 5% (500 bps)
- Bands: floor 2% (200 bps), ceiling 4% (400 bps)
- Result: Risk clamped to 4%, effective APY = 16% (2000 - 400 bps)

### Operational Considerations

1. **Parameter Bounds**: Maximum 500% (50,000 bps) to prevent extreme values
2. **Governance Control**: Only `GOV_ROLE` can set overrides
3. **Event Emission**: All changes emit `TrancheBaseApyOverrideSet` events
4. **Telemetry Integration**: Override usage is tracked via `FLAG_BASE_APY_OVERRIDE_USED`
5. **Gas Costs**: ~20k gas per setter call, minimal read costs

### Monitoring and Alerts

- **Override Usage**: Track which tranches have active overrides
- **Yield Impact**: Monitor effective APY changes from overrides
- **Governance Activity**: Alert on override changes
- **Telemetry Analysis**: Use flags to understand decision paths

## Future Enhancements

- **Dynamic Fees**: Automatic fee adjustment based on market conditions
- **Advanced PMM**: More sophisticated PMM curve parameters
- **Gas Optimization**: Further gas optimization for high-frequency operations
- **Analytics Dashboard**: Real-time economics dashboard
- **Automated Monitoring**: Automated alerts for parameter breaches

## Redemption Queue Prioritization (Read-Only)

### Overview

The redemption queue prioritization system provides a read-only scoring mechanism to determine the priority of redemption requests based on risk adjustment, age, and size with governance-configurable weights.

### Purpose

- **Fair Queue Management**: Ensure redemption requests are processed in order of urgency and importance
- **Risk-Based Prioritization**: Prioritize redemptions during high-risk periods
- **Age-Based Fairness**: Prevent requests from being stuck in queue indefinitely
- **Size-Based Efficiency**: Balance large vs. small redemption requests

### Priority Score Formula

The priority score is computed using a weighted combination of three components:

```
priorityScore = (riskComponent * riskWeightBps + ageComponent * ageWeightBps + sizeComponent * sizeWeightBps) / 10000
```

Where each component is normalized to 0-10000 basis points.

### Component Calculations

#### Risk Component
- **Input**: Final risk adjustment from tranche telemetry
- **Calculation**: `riskComponent = (finalRiskAdjBps * 10000) / maxApyBps`
- **Range**: 0-10000 bps
- **Logic**: Higher risk adjustment = higher priority (more urgent)

#### Age Component
- **Input**: Request timestamp, current time, minimum age threshold
- **Calculation**: Linear boost from `minAgeDays` to 365 days
- **Range**: 0-10000 bps
- **Logic**: Older requests get higher priority (fairness)

#### Size Component
- **Input**: Redemption amount, size threshold
- **Calculation**: Linear boost from threshold to 10x threshold
- **Range**: 0-10000 bps
- **Logic**: Larger amounts get higher priority (efficiency)

### Governance Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `redemptionWeightRiskBps` | 4000 (40%) | 0-10000 bps | Weight for risk adjustment component |
| `redemptionWeightAgeBps` | 3000 (30%) | 0-10000 bps | Weight for age component |
| `redemptionWeightSizeBps` | 3000 (30%) | 0-10000 bps | Weight for size component |
| `minAgeDaysForBoost` | 7 days | 0-365 days | Minimum age for age boost |
| `sizeBoostThreshold` | 10,000 USDC | 0-1,000,000 USDC | Size threshold for boost |

### Reason Flags

The system provides reason flags to explain priority decisions:

| Flag | Value | Description |
|------|-------|-------------|
| `FLAG_RISK_HIGH` | 0x0001 | High risk adjustment (>25%) |
| `FLAG_SIZE_LARGE` | 0x0002 | Large redemption amount (≥threshold) |
| `FLAG_AGE_OLD` | 0x0004 | Old redemption request (≥minAgeDays) |
| `FLAG_CAP_PRESSURE` | 0x0008 | Near capacity limits (future) |

### Example Scenarios

#### Scenario 1: Standard Priority
- Risk adjustment: 200 bps (2%)
- Age: 5 days (below 7-day threshold)
- Size: 5,000 USDC (below 10k threshold)
- Result: Low priority score, no reason flags

#### Scenario 2: High Risk Priority
- Risk adjustment: 3,000 bps (30%)
- Age: 3 days
- Size: 8,000 USDC
- Result: High priority due to risk, `FLAG_RISK_HIGH` set

#### Scenario 3: Age-Based Priority
- Risk adjustment: 150 bps (1.5%)
- Age: 30 days (above 7-day threshold)
- Size: 7,000 USDC
- Result: Medium priority due to age, `FLAG_AGE_OLD` set

#### Scenario 4: Size-Based Priority
- Risk adjustment: 100 bps (1%)
- Age: 2 days
- Size: 50,000 USDC (above 10k threshold)
- Result: High priority due to size, `FLAG_SIZE_LARGE` set

#### Scenario 5: Multi-Factor Priority
- Risk adjustment: 2,500 bps (25%)
- Age: 60 days
- Size: 100,000 USDC
- Result: Very high priority, all flags set

### Integration with Existing Systems

- **TrancheReadFacade**: Uses telemetry data for risk adjustment
- **ConfigRegistry**: Provides governance-configurable weights and thresholds
- **Telemetry**: Reason flags align with decision path analysis
- **Future**: Can integrate with capacity monitoring for `FLAG_CAP_PRESSURE`

### Operational Considerations

1. **Weight Balancing**: Ensure weights sum to ≤100% for predictable scoring
2. **Threshold Tuning**: Adjust thresholds based on queue behavior and market conditions
3. **Monitoring**: Track reason flag distribution to understand queue dynamics
4. **Gas Efficiency**: Read-only design minimizes gas costs for priority computation

