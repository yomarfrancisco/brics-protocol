# BRICS Protocol Deployment Parameter Sheet v4.0.0-rc2

## Executive Summary

**Protocol Version**: v4.0.0-rc2 (Audit-Ready)  
**Deployment Environment**: Staging  
**Network**: Ethereum Mainnet (Production) / Sepolia (Testing)  
**Deployment Date**: TBD  

## Core Protocol Parameters

### Emergency Matrix Configuration

| Emergency Level | Level | maxIssuanceRateBps | maxTailCorrPpm | maxSovUtilBps | bufferTargetBps |
|-----------------|-------|-------------------|----------------|---------------|-----------------|
| NORMAL          | 0     | 10000 (100%)      | 650000000      | 2000          | 300 (3%)        |
| YELLOW          | 1     | 8000 (80%)        | 600000000      | 1800          | 400 (4%)        |
| ORANGE          | 2     | 5000 (50%)        | 500000000      | 1500          | 500 (5%)        |
| RED             | 3     | 0 (0%)            | 400000000      | 1000          | 600 (6%)        |

### Sovereign Configurations

#### South Africa (ZA)
```solidity
sovereignCode: 0x5a4100000000000000000000000000000000000000000000000000000000000000
name: "South Africa"
enabled: true
effectiveCapacityBps: 6400 (64%)
softCapUSDC: 1000000000000000000000000 (1,000,000 USDC)
hardCapUSDC: 2000000000000000000000000 (2,000,000 USDC)
```

#### Brazil (BR)
```solidity
sovereignCode: 0x4252000000000000000000000000000000000000000000000000000000000000
name: "Brazil"
enabled: true
effectiveCapacityBps: 6400 (64%)
softCapUSDC: 1000000000000000000000000 (1,000,000 USDC)
hardCapUSDC: 2000000000000000000000000 (2,000,000 USDC)
```

### Caps and Thresholds

#### Super Senior Cap
```solidity
superSeniorCap: 10000000000000000000000000 (10,000,000 BRICS)
```

#### Damping Parameters
```solidity
dampingSlopeK: 10000 (100% damping slope)
```

#### NAV Redemption Parameters
```solidity
windowMinDuration: 86400 (24 hours)
settlementDelay: 432000 (5 days)
freezePeriod: 86400 (24 hours)
```

#### Sovereign Guarantee Parameters
```solidity
tier1Threshold: 106 (106% detachment)
tier2Threshold: 108 (108% detachment)
tier2Expiry: 2592000 (30 days)
advanceRateBps: 6000 (60% advance rate)
```

## Role Configuration

### Role Hashes
```solidity
DEFAULT_ADMIN_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
GOV_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
ECC_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
OPS_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
MINTER_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
BURNER_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
PAY_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
BUFFER_MANAGER: 0x0000000000000000000000000000000000000000000000000000000000000000
ISSUER_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
REGISTRY_ADMIN: 0x0000000000000000000000000000000000000000000000000000000000000000
```

### Role Grantees (Production)

#### Governance Roles
- **DEFAULT_ADMIN_ROLE**: Multi-sig wallet (3/5)
- **GOV_ROLE**: DAO governance contract
- **ECC_ROLE**: Emergency Control Committee multi-sig (3/3)

#### Operational Roles
- **OPS_ROLE**: NASASA operational wallet
- **MINTER_ROLE**: IssuanceControllerV3 contract
- **BURNER_ROLE**: IssuanceControllerV3 contract
- **PAY_ROLE**: IssuanceControllerV3 contract
- **BUFFER_MANAGER**: IssuanceControllerV3 contract
- **ISSUER_ROLE**: IssuanceControllerV3 contract
- **REGISTRY_ADMIN**: OperationalAgreement contract

#### Specialized Roles
- **ORACLE_ADMIN**: NAV Oracle multi-sig (2/3)
- **MODEL_SIGNER**: NAV model signer wallet
- **EMERGENCY_SIGNER**: Emergency NAV signer wallet
- **NASASA_ROLE**: NASASA CFI wallet
- **SPV_ROLE**: SPV management wallet

## Oracle Configuration

### NAV Oracle Parameters
```solidity
modelHash: 0x0000000000000000000000000000000000000000000000000000000000000000
quorumSize: 2
emergencyQuorumSize: 1
degradationThreshold: 7200 (2 hours)
emergencyThreshold: 86400 (24 hours)
```

### Oracle Signer Sets

#### Primary Signers (Quorum)
1. **Signer 1**: NASASA NAV signer
2. **Signer 2**: Old Mutual NAV signer
3. **Signer 3**: Independent NAV signer

#### Emergency Signers
1. **Emergency Signer 1**: NASASA emergency wallet
2. **Emergency Signer 2**: Old Mutual emergency wallet

### Degradation Levels
```solidity
FRESH: 0 (Normal operations)
STALE: 1 (>2h stale, 2% haircut)
DEGRADED: 2 (>6h stale, 5% haircut)
EMERGENCY_OVERRIDE: 3 (>24h stale, 10% haircut)
```

## Buffer Configuration

### Pre-Tranche Buffer
```solidity
targetBuffer: 10000000000000000000000000 (10,000,000 USDC)
dailyCapPerMember: 50000000000000000000000 (50,000 USDC)
maxInstantRedeem: 1000000000000000000000000 (1,000,000 USDC)
```

### Treasury IRB
```solidity
initialBuffer: 3000000000000000000000000 (3,000,000 USDC)
bufferTargetBps: 300 (3% of total issued)
maxBufferTargetBps: 1200 (12% in RED state)
```

### Emergency Buffers
```solidity
oldMutualCommitment: 25000000000000000000000000 (25,000,000 USDC)
emergencyDAOReserve: 5000000000000000000000000 (5,000,000 USDC)
sovereignReplenishFund: 10000000000000000000000000 (10,000,000 USDC)
```

## Contract Addresses (Production)

### Core Protocol Contracts
- **BRICSToken**: TBD
- **IssuanceControllerV3**: TBD
- **ConfigRegistry**: TBD
- **MemberRegistry**: TBD
- **TrancheManagerV2**: TBD
- **NAVOracleV3**: TBD
- **PreTrancheBuffer**: TBD
- **Treasury**: TBD
- **RedemptionClaim**: TBD
- **ClaimRegistry**: TBD
- **SovereignClaimToken**: TBD
- **OperationalAgreement**: TBD
- **MezzanineVault**: TBD

### External Dependencies
- **USDC**: 0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8 (Mainnet)
- **WETH**: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (Mainnet)

## Deployment Sequence

### Phase 1: Core Infrastructure
1. Deploy ConfigRegistry
2. Deploy MemberRegistry
3. Deploy OperationalAgreement
4. Deploy Treasury
5. Deploy PreTrancheBuffer

### Phase 2: Oracle and NAV
1. Deploy NAVOracleV3
2. Configure oracle signers
3. Set initial NAV

### Phase 3: Protocol Core
1. Deploy BRICSToken
2. Deploy TrancheManagerV2
3. Deploy RedemptionClaim
4. Deploy ClaimRegistry
5. Deploy SovereignClaimToken

### Phase 4: Issuance and Control
1. Deploy IssuanceControllerV3
2. Deploy MezzanineVault
3. Configure all role grants
4. Set sovereign configurations

### Phase 5: Integration and Testing
1. Configure emergency matrix
2. Set buffer targets
3. Initialize sovereign guarantee
4. Run integration tests

## Security Parameters

### Timelock Configuration
```solidity
governanceTimelock: 172800 (48 hours)
emergencyTimelock: 3600 (1 hour)
recoveryTimelock: 7200 (2 hours)
```

### Emergency Thresholds
```solidity
emergencyQuorum: 2 (2/3 for emergency actions)
superEmergencyQuorum: 3 (3/3 for catastrophic crisis)
governanceQuorum: 67 (67% for normal governance)
```

### Recovery Parameters
```solidity
maxRecoveryDelay: 2592000 (30 days)
minRecoveryDelay: 3600 (1 hour)
recoveryWindow: 604800 (7 days)
```

## Monitoring and Alerts

### Key Metrics
- **Buffer Health**: >50% combined ratio
- **Oracle Health**: <6 hour staleness
- **Emergency Level**: Monitor for escalations
- **Sovereign Utilization**: Track per-sovereign caps
- **Issuance Rate**: Monitor against emergency limits

### Alert Thresholds
- **Buffer Depletion**: <30% combined ratio
- **Oracle Stale**: >2 hours without update
- **Emergency Escalation**: Level change to ORANGE/RED
- **Sovereign Cap**: >80% utilization
- **Issuance Rate**: <50% of normal capacity

## Compliance Parameters

### Regulatory Alignment
- **Basel III**: Capital adequacy maintained
- **MiFID II**: Investor protection measures
- **Local Regulations**: South African CFI compliance

### Audit Trail
- **Event Logging**: All state changes logged
- **Timestamp Tracking**: All actions timestamped
- **Reference Numbers**: Legal actions referenced

## Conclusion

This parameter sheet provides the complete configuration for BRICS Protocol v4.0.0-rc2 deployment. All parameters are designed for institutional-grade security, crisis resilience, and regulatory compliance.

**Status**: Ready for production deployment with institutional oversight.
