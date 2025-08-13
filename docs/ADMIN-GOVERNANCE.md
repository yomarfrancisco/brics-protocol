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
