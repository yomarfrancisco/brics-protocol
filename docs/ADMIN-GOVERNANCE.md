# Admin Governance Guide

This document provides a comprehensive guide for administrators managing the BRICS protocol, including roles, permissions, and operational procedures.

## Roles Overview

### Production Roles

| Role | Holder | Description |
|------|--------|-------------|
| `DEFAULT_ADMIN_ROLE` | DAO Multisig | Can grant/revoke all other roles |
| `GOV_ROLE` | DAO Multisig | Can modify protocol parameters and emergency settings |
| `ECC_ROLE` | Emergency Committee | Can set emergency levels |
| `PAUSER_ROLE` | DAO Multisig | Can pause/unpause critical functions |
| `PAY_ROLE` | Treasury Ops | Can execute treasury payments |
| `MINTER_ROLE` | Issuance Controller | Can mint BRICS tokens |
| `BURNER_ROLE` | Redemption Lane | Can burn BRICS tokens |

### Development Roles

In development environments, the deployer account typically holds all roles for testing purposes.

## Protocol Parameters

### ConfigRegistry Parameters

The following parameters can be modified by `GOV_ROLE` holders:

#### Global Risk Limits
- `maxTailCorrPpm`: Maximum tail correlation (0-1,000,000,000 ppm)
- `maxSovUtilBps`: Maximum sovereign utilization (0-10,000 bps)
- `redeemCapBps`: Redemption capacity (0-10,000 bps)
- `instantBufferBps`: Instant redemption buffer (0-10,000 bps)

#### Emergency Levels
- **Level 0 (Normal)**: ±2% price bounds
- **Level 1 (Amber)**: ±1% price bounds  
- **Level 2 (Red)**: ±0.25% price bounds
- **Level 3+ (Disabled)**: Most restrictive bounds

#### Issuance Caps
- `issuanceCapBufferBps`: Issuance cap buffer (0-10,000 bps)
- **Default**: 500 bps (5% buffer)
- **Calculation**: `maxIssuable = capacity * (10000 - bufferBps) / 10000`

### Treasury Parameters
- `bufferTargetBps`: Target buffer size in basis points

## How to Change Parameters Safely

### 1. Pre-Change Checklist
- [ ] Verify current parameter values
- [ ] Calculate impact on protocol operations
- [ ] Test changes on staging environment
- [ ] Prepare rollback plan
- [ ] Notify stakeholders

### 2. Parameter Update Process

```solidity
// Example: Update instant redemption buffer
await configRegistry.setInstantBufferBps(500); // 5%

// Example: Update emergency level
await configRegistry.setEmergencyLevel(1, "Market volatility detected");

// Example: Update treasury buffer target
await treasury.setBufferTargetBps(1500); // 15%
```

### 3. Post-Change Verification
- [ ] Verify parameter was updated correctly
- [ ] Monitor protocol behavior
- [ ] Check for any unexpected side effects
- [ ] Update documentation

## Adjusting Issuance Buffer & Swapping Capacity Oracle

### Issuance Buffer Adjustment

The issuance buffer controls how much below the oracle-reported capacity the protocol will issue:

```solidity
// Example: Set 10% buffer (more conservative)
await configRegistry.setIssuanceCapBufferBps(1000); // 10%

// Example: Set 2% buffer (less conservative)
await configRegistry.setIssuanceCapBufferBps(200); // 2%
```

### Capacity Oracle Management

When swapping capacity oracles:

1. **Pre-swap Checklist**:
   - [ ] Verify new oracle implements `ISovereignCapacityOracle`
   - [ ] Test oracle integration on staging
   - [ ] Ensure oracle provides capacity in correct units (USDC 6dp)
   - [ ] Verify oracle timestamp freshness

2. **Oracle Swap Process**:
   ```solidity
   // Update oracle address in relevant contracts
   await issuanceController.setCapacityOracle(newOracleAddress);
   
   // Verify oracle is working
   (uint256 capacity, uint64 asOf) = await newOracle.latestCapacity();
   require(capacity > 0, "Invalid capacity");
   require(asOf > block.timestamp - 3600, "Stale data");
   ```

3. **Post-swap Verification**:
   - [ ] Monitor issuance cap enforcement
   - [ ] Verify capacity updates are timely
   - [ ] Check for any issuance failures
   - [ ] Update oracle documentation

## Tranche Risk Oracle Management

### Risk Oracle Adapter Configuration

The `TrancheRiskOracleAdapter` provides additional safety controls:

```solidity
// Update oracle address
await riskAdapter.setOracle(newOracleAddress);

// Update staleness threshold
await riskAdapter.setMaxAge(7200); // 2 hours
```

### Risk Oracle Swap Process

When swapping tranche risk oracles:

1. **Pre-swap Checklist**:
   - [ ] Verify new oracle implements `ITrancheRiskOracle`
   - [ ] Test adapter integration on staging
   - [ ] Ensure oracle provides risk adjustments in basis points
   - [ ] Verify oracle timestamp freshness
   - [ ] Set appropriate max age for staleness checks

2. **Oracle Swap Process**:
   ```solidity
   // Update oracle in adapter
   await riskAdapter.setOracle(newOracleAddress);
   
   // Verify adapter is working
   (uint16 riskAdj, uint64 ts) = await riskAdapter.latestRisk(trancheId);
   require(ts > block.timestamp - 3600, "Stale data");
   ```

3. **Post-swap Verification**:
   - [ ] Monitor staleness check enforcement
   - [ ] Verify risk adjustments are reasonable
   - [ ] Check for any `StaleRiskData` reverts
   - [ ] Update adapter documentation

## Per-Tranche Risk Override Management

### Setting Risk Overrides

Risk overrides can be set per tranche for emergency adjustments or manual corrections:

```solidity
// Set override for specific tranche
await configRegistry.setTrancheRiskAdjOverrideBps(trancheId, 150); // 1.5% risk

// Remove override (set to 0)
await configRegistry.setTrancheRiskAdjOverrideBps(trancheId, 0);
```

### Override Adjustment Checklist

When adjusting risk overrides:

1. **Pre-adjustment Checklist**:
   - [ ] Verify current oracle/adapter risk values
   - [ ] Calculate impact on effective APY
   - [ ] Ensure override is within bounds (0 ≤ override ≤ maxBoundBps)
   - [ ] Test override on staging environment
   - [ ] Prepare rollback plan

2. **Override Process**:
   ```solidity
   // Set override
   await configRegistry.setTrancheRiskAdjOverrideBps(trancheId, newOverride);
   
   // Verify override is applied
   uint16 override = await configRegistry.trancheRiskAdjOverrideBps(trancheId);
   require(override == newOverride, "Override not set");
   
   // Test APY calculation
   (uint16 apyBps, uint64 asOf) = await facade.viewEffectiveApy(trancheId);
   console.log("New effective APY:", apyBps);
   ```

3. **Post-adjustment Verification**:
   - [ ] Monitor effective APY changes
   - [ ] Verify override takes precedence over oracle/adapter
   - [ ] Check that stale data is bypassed when override > 0
   - [ ] Update override documentation
   - [ ] Plan removal timeline if temporary

4. **Rollback Process**:
   ```solidity
   // Remove override (restore oracle/adapter behavior)
   await configRegistry.setTrancheRiskAdjOverrideBps(trancheId, 0);
   
   // Verify rollback
   uint16 override = await configRegistry.trancheRiskAdjOverrideBps(trancheId);
   require(override == 0, "Override not removed");
   ```

## Risk Confidence Bands Management

### Setting Risk Bands

Risk confidence bands can be set per tranche to clamp risk adjustments to safe ranges:

```solidity
// Set bands for specific tranche
await configRegistry.setTrancheRiskBands(trancheId, 200, 400); // 2% to 4% risk

// Disable bands (no clamping)
await configRegistry.setTrancheRiskBands(trancheId, 0, 0);
```

### Band Adjustment Checklist

When adjusting risk confidence bands:

1. **Pre-adjustment Checklist**:
   - [ ] Verify current oracle/adapter risk values
   - [ ] Calculate impact on effective APY ranges
   - [ ] Ensure bands are valid (floor ≤ ceil ≤ maxBoundBps)
   - [ ] Test bands on staging environment
   - [ ] Prepare rollback plan

2. **Band Process**:
   ```solidity
   // Set bands
   await configRegistry.setTrancheRiskBands(trancheId, floorBps, ceilBps);
   
   // Verify bands are applied
   uint16 floor = await configRegistry.trancheRiskFloorBps(trancheId);
   uint16 ceil = await configRegistry.trancheRiskCeilBps(trancheId);
   require(floor == floorBps && ceil == ceilBps, "Bands not set");
   
   // Test APY calculation with bands
   (uint16 apyBps, uint64 asOf) = await facade.viewEffectiveApy(trancheId);
   console.log("APY with bands:", apyBps);
   ```

3. **Post-adjustment Verification**:
   - [ ] Monitor effective APY changes
   - [ ] Verify bands clamp risk adjustments correctly
   - [ ] Check that bands work with overrides and staleness
   - [ ] Update band documentation

## Rolling Average Risk Management

### Enabling Rolling Average

Rolling average risk calculation can be enabled per tranche to smooth out volatility:

```solidity
// Enable rolling average for specific tranche
await configRegistry.setTrancheRollingEnabled(trancheId, true);

// Set window size (1-90 days)
await configRegistry.setTrancheRollingWindow(trancheId, 7); // 7-day window

// Disable rolling average
await configRegistry.setTrancheRollingEnabled(trancheId, false);
```

### Rolling Average Adjustment Checklist

When configuring rolling average:

1. **Pre-configuration Checklist**:
   - [ ] Verify current oracle/adapter risk values
   - [ ] Calculate expected smoothing effect
   - [ ] Ensure window size is appropriate (1-90 days)
   - [ ] Test configuration on staging environment
   - [ ] Prepare rollback plan

2. **Configuration Process**:
   ```solidity
   // Enable rolling average
   await configRegistry.setTrancheRollingEnabled(trancheId, true);
   await configRegistry.setTrancheRollingWindow(trancheId, windowDays);
   
   // Verify configuration
   bool enabled = await configRegistry.trancheRollingEnabled(trancheId);
   uint16 window = await configRegistry.trancheRollingWindowDays(trancheId);
   require(enabled && window == windowDays, "Config not set");
   
   // Test APY calculation with rolling average
   (uint16 apyBps, uint64 asOf) = await facade.viewEffectiveApy(trancheId);
   console.log("APY with rolling average:", apyBps);
   ```

3. **Post-configuration Verification**:
   - [ ] Monitor effective APY changes
   - [ ] Verify rolling average smooths volatility
   - [ ] Check that rolling average works with overrides and bands
   - [ ] Update rolling average documentation

4. **Rollback Process**:
   ```solidity
   // Disable rolling average (restore direct oracle/adapter behavior)
   await configRegistry.setTrancheRollingEnabled(trancheId, false);
   
   // Verify rollback
   bool enabled = await configRegistry.trancheRollingEnabled(trancheId);
   require(!enabled, "Rolling average not disabled");
   ```

### Data Recording Management

Rolling average requires regular recording of risk adjustment points:

```solidity
// Record risk adjustment point
await configRegistry.recordTrancheRiskPoint(trancheId, riskAdjBps, timestamp);
```

### Operational Considerations

1. **Data Recording Frequency**: Record points daily or when risk values change significantly
2. **Window Size Selection**: 
   - Short window (1-7 days): More responsive, less smoothing
   - Medium window (7-30 days): Balanced smoothing and responsiveness
   - Long window (30-90 days): Maximum smoothing, less responsive
3. **Gas Costs**: Each data point recording costs ~50k gas
4. **Storage Limits**: Maximum 30 data points per tranche
5. **Governance**: Window size and enable/disable controls per tranche

### Expected Operational Cadence

- **Daily**: Record risk adjustment points for active tranches
- **Weekly**: Monitor rolling average effectiveness
- **Monthly**: Review window sizes and adjust if needed
- **Quarterly**: Evaluate overall rolling average performance
   - [ ] Plan adjustment timeline if temporary

4. **Rollback Process**:
   ```solidity
   // Disable bands (restore unclamped behavior)
   await configRegistry.setTrancheRiskBands(trancheId, 0, 0);
   
   // Verify rollback
   uint16 floor = await configRegistry.trancheRiskFloorBps(trancheId);
   uint16 ceil = await configRegistry.trancheRiskCeilBps(trancheId);
   require(floor == 0 && ceil == 0, "Bands not disabled");
   ```

## Emergency Procedures

### Setting Emergency Levels

Emergency levels can be set by `GOV_ROLE` or `ECC_ROLE` holders:

```solidity
// Set emergency level with reason
await configRegistry.setEmergencyLevel(1, "High market volatility");

// Set emergency level 2 (more restrictive)
await configRegistry.setEmergencyLevel(2, "Extreme market conditions");
```

### Emergency Level Effects

| Level | Price Bounds | Issuance Rate | Buffer Size |
|-------|-------------|---------------|-------------|
| 0 (Normal) | ±2% | 100% | 3% |
| 1 (Amber) | ±1% | 100% | 5% |
| 2 (Red) | ±0.25% | 50% | 8% |
| 3+ (Disabled) | ±0.25% | 0% | 12% |

### Pausing Protocol Functions

Critical functions can be paused by `PAUSER_ROLE` holders:

```solidity
// Pause InstantLane
await instantLane.pause();

// Unpause InstantLane
await instantLane.unpause();
```

**Note**: View functions remain accessible when paused.

## Treasury Operations

### Funding Treasury

```solidity
// Fund treasury with USDC
await usdc.approve(treasury.getAddress(), amount);
await treasury.fund(amount);
```

### Making Payments

Only `PAY_ROLE` holders can execute treasury payments:

```solidity
// Pay USDC to recipient
await treasury.pay(recipientAddress, amount);
```

### Monitoring Treasury Health

```solidity
// Get liquidity status
const (preTranche, irbBalance, irbTarget, shortfallBps, healthy) = 
  await treasury.getLiquidityStatus();
```

## Sovereign Management

### Adding Sovereigns

```solidity
await configRegistry.addSovereign(
  sovereignCode,    // bytes32 identifier
  utilCapBps,       // Utilization cap (0-10,000 bps)
  haircutBps,       // Haircut rate (0-10,000 bps)
  weightBps,        // Weight in pool (0-10,000 bps)
  enabled           // Whether enabled
);
```

### Updating Sovereigns

```solidity
await configRegistry.updateSovereign(
  sovereignCode,
  newUtilCapBps,
  newHaircutBps,
  newWeightBps,
  newEnabled
);
```

### Enabling/Disabling Sovereigns

```solidity
// Enable sovereign
await configRegistry.setSovereignEnabled(sovereignCode, true);

// Disable sovereign
await configRegistry.setSovereignEnabled(sovereignCode, false);
```

## Read-Only Verification Endpoints

### Risk API Safety Checks

The Risk API provides signed endpoints for verifying safety parameters:

### Economics Parameters

For economic parameter management, see the [Economics Parameters Guide](ECONOMICS.md).

```bash
# Check lane pre-trade bounds
curl "http://localhost:8000/api/v1/lane/pretrade?price_bps=10000&emergency_level=0"

# Check NAV sanity
curl "http://localhost:8000/api/v1/oracle/nav-sanity?proposed_nav_ray=1000000000000000000000000000"
```

### On-Chain View Functions

```solidity
// Get current emergency level bounds
const (minBps, maxBps) = await configRegistry.getBoundsForLevel(0);

// Get current emergency parameters
const params = await configRegistry.getCurrentParams();

// Check if price is within bounds
const (ok, min, max) = await instantLane.preTradeCheck(10000, 0);
```

## Security Considerations

### Access Control
- All admin functions are protected by role-based access control
- Zero-address checks are enforced for critical parameters
- Parameter bounds are validated to prevent invalid values

### Emergency Procedures
- Emergency levels can be set quickly by authorized parties
- Pause functionality provides immediate circuit-breaker capability
- All changes emit events for transparency and monitoring

### Monitoring
- All parameter changes emit events with old/new values
- Treasury operations are logged with recipient and amount
- Emergency level changes include reason for audit trail

## Troubleshooting

### Common Issues

1. **Transaction Reverts with "AccessControl"**
   - Verify the calling account has the required role
   - Check if the role was properly granted

2. **Parameter Update Fails**
   - Verify the new value is within allowed bounds
   - Check if the parameter is locked during emergency

3. **Treasury Payment Fails**
   - Verify sufficient balance in treasury
   - Check if recipient address is valid (not zero address)

### Recovery Procedures

1. **Emergency Level Recovery**
   ```solidity
   // Return to normal operations
   await configRegistry.setEmergencyLevel(0, "Market conditions normalized");
   ```

2. **Protocol Unpause**
   ```solidity
   // Resume normal operations
   await instantLane.unpause();
   ```

3. **Parameter Rollback**
   ```solidity
   // Rollback to previous value
   await configRegistry.setInstantBufferBps(previousValue);
   ```

## Future Enhancements

- Multi-signature requirements for critical parameter changes
- Time-delayed parameter updates for additional safety
- Automated monitoring and alerting systems
- Enhanced emergency response procedures
