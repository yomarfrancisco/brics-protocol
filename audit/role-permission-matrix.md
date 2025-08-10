# BRICS Protocol Role/Permission Matrix v4.0.0-rc2

## Overview

This document provides a comprehensive mapping of roles and permissions across all BRICS Protocol contracts. Each role has specific responsibilities and access controls to ensure institutional-grade security and governance.

## Role Definitions

### Core Roles
- **DEFAULT_ADMIN_ROLE**: Super admin with ability to grant/revoke all roles
- **GOV_ROLE**: Governance decisions and parameter updates
- **ECC_ROLE**: Emergency Control Committee for crisis management
- **OPS_ROLE**: Operational actions and daily protocol management
- **MINTER_ROLE**: Token minting permissions
- **BURNER_ROLE**: Token burning permissions
- **PAY_ROLE**: Treasury payment permissions
- **BUFFER_MANAGER**: Buffer management permissions
- **ISSUER_ROLE**: Claim issuance permissions
- **REGISTRY_ADMIN**: Registry management permissions

## Contract-Specific Role Matrix

### ConfigRegistry.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `setEmergencyLevel()` | ❌ | ✅ | ✅ | ❌ | - |
| `setEmergencyParams()` | ❌ | ✅ | ✅ | ❌ | - |
| `addSovereign()` | ❌ | ✅ | ❌ | ❌ | - |
| `updateSovereign()` | ❌ | ✅ | ❌ | ❌ | - |
| `setSovereignEnabled()` | ❌ | ✅ | ❌ | ❌ | - |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### IssuanceControllerV3.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `mintFor()` | ❌ | ❌ | ❌ | ✅ | - |
| `mintForSigned()` | ❌ | ❌ | ❌ | ✅ | - |
| `requestRedeemOnBehalf()` | ❌ | ❌ | ❌ | ✅ | - |
| `settleClaim()` | ❌ | ❌ | ❌ | ❌ | BURNER_ROLE |
| `openNavWindow()` | ❌ | ❌ | ❌ | ✅ | - |
| `closeNavWindow()` | ❌ | ❌ | ❌ | ✅ | - |
| `mintClaimsForWindow()` | ❌ | ❌ | ❌ | ✅ | - |
| `strikeRedemption()` | ❌ | ❌ | ❌ | ✅ | - |
| `requestMintNonceReset()` | ❌ | ❌ | ✅ | ❌ | - |
| `executeMintNonceReset()` | ❌ | ❌ | ✅ | ❌ | - |
| `forceOracleRecovery()` | ❌ | ❌ | ✅ | ❌ | - |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### BRICSToken.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `mint()` | ❌ | ❌ | ❌ | ❌ | MINTER_ROLE |
| `burn()` | ❌ | ❌ | ❌ | ❌ | BURNER_ROLE |
| `_update()` | ❌ | ❌ | ❌ | ❌ | Internal |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### MemberRegistry.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `setMember()` | ❌ | ❌ | ❌ | ❌ | REGISTRY_ADMIN |
| `setPool()` | ❌ | ❌ | ❌ | ❌ | REGISTRY_ADMIN |
| `canSend()` | ❌ | ❌ | ❌ | ❌ | View |
| `canReceive()` | ❌ | ❌ | ❌ | ❌ | View |
| `isWhitelistedPool()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### TrancheManagerV2.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `raiseDetachment()` | ❌ | ✅ | ✅ | ❌ | - |
| `emergencyExpandToSoftCap()` | ❌ | ❌ | ✅ | ❌ | - |
| `adjustSuperSeniorCap()` | ❌ | ✅ | ❌ | ❌ | - |
| `ratifyDetachment()` | ❌ | ✅ | ❌ | ❌ | - |
| `maybeRevertDetachment()` | ❌ | ✅ | ❌ | ❌ | - |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### NAVOracleV3.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `setNAV()` | ❌ | ❌ | ❌ | ❌ | ORACLE_ADMIN |
| `emergencySetNAV()` | ❌ | ❌ | ❌ | ❌ | EMERGENCY_SIGNER |
| `toggleDegradationMode()` | ❌ | ❌ | ✅ | ❌ | - |
| `navRay()` | ❌ | ❌ | ❌ | ❌ | View |
| `getDegradationLevel()` | ❌ | ❌ | ❌ | ❌ | View |
| `getCurrentHaircutBps()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### PreTrancheBuffer.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `instantRedeem()` | ❌ | ❌ | ❌ | ❌ | BUFFER_MANAGER |
| `fundBuffer()` | ❌ | ✅ | ❌ | ❌ | - |
| `availableInstantCapacity()` | ❌ | ❌ | ❌ | ❌ | View |
| `getBufferStatus()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### Treasury.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `pay()` | ❌ | ❌ | ❌ | ❌ | PAY_ROLE |
| `fund()` | ❌ | ❌ | ❌ | ❌ | PAY_ROLE |
| `setBufferTargetBps()` | ❌ | ✅ | ❌ | ❌ | - |
| `getLiquidityStatus()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### RedemptionClaim.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `mintClaim()` | ❌ | ❌ | ❌ | ❌ | ISSUER_ROLE |
| `settleAndBurn()` | ❌ | ❌ | ❌ | ❌ | ISSUER_ROLE |
| `claimInfo()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### ClaimRegistry.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `triggerClaim()` | ❌ | ❌ | ✅ | ❌ | - |
| `serveNotice()` | ❌ | ❌ | ❌ | ✅ | - |
| `recordAcknowledgment()` | ❌ | ❌ | ❌ | ✅ | - |
| `schedulePayment()` | ❌ | ❌ | ❌ | ✅ | - |
| `recordSettlement()` | ❌ | ❌ | ❌ | ✅ | - |
| `expandToTier2()` | ❌ | ❌ | ✅ | ❌ | - |
| `enforceTier2Expiry()` | ❌ | ❌ | ✅ | ❌ | - |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### SovereignClaimToken.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `unlockClaim()` | ❌ | ❌ | ✅ | ❌ | - |
| `exerciseClaim()` | ❌ | ❌ | ✅ | ❌ | - |
| `claimInfo()` | ❌ | ❌ | ❌ | ❌ | View |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### OperationalAgreement.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `approveMember()` | ❌ | ❌ | ❌ | ❌ | NASASA_ROLE |
| `revokeMember()` | ❌ | ❌ | ❌ | ❌ | NASASA_ROLE |
| `approvePool()` | ❌ | ❌ | ❌ | ❌ | SPV_ROLE |
| `revokePool()` | ❌ | ❌ | ❌ | ❌ | SPV_ROLE |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

### MezzanineVault.sol

| Function | DEFAULT_ADMIN_ROLE | GOV_ROLE | ECC_ROLE | OPS_ROLE | Other Roles |
|----------|-------------------|----------|----------|----------|-------------|
| `deposit()` | ❌ | ❌ | ❌ | ❌ | Whitelisted |
| `withdraw()` | ❌ | ❌ | ❌ | ❌ | Whitelisted |
| `redeem()` | ❌ | ❌ | ❌ | ❌ | Whitelisted |
| `grantRole()` | ✅ | ❌ | ❌ | ❌ | - |
| `revokeRole()` | ✅ | ❌ | ❌ | ❌ | - |

## Role Hierarchy and Escalation

### Normal Operations
```
DEFAULT_ADMIN_ROLE
├── GOV_ROLE (Governance)
├── OPS_ROLE (Operations)
├── MINTER_ROLE (Token Minting)
├── BURNER_ROLE (Token Burning)
├── PAY_ROLE (Treasury)
├── BUFFER_MANAGER (Buffer Management)
├── ISSUER_ROLE (Claim Issuance)
└── REGISTRY_ADMIN (Registry Management)
```

### Emergency Operations
```
DEFAULT_ADMIN_ROLE
├── ECC_ROLE (Emergency Control Committee)
│   ├── Emergency parameter updates
│   ├── Oracle recovery procedures
│   ├── Sovereign claim triggering
│   └── Crisis management
└── EMERGENCY_SIGNER (Oracle Emergency)
```

### Specialized Roles
```
DEFAULT_ADMIN_ROLE
├── ORACLE_ADMIN (NAV Oracle Management)
├── MODEL_SIGNER (NAV Model Signing)
├── EMERGENCY_SIGNER (Emergency NAV Updates)
├── NASASA_ROLE (Member Management)
└── SPV_ROLE (Pool Management)
```

## Security Considerations

### Role Separation
- **Governance vs Operations**: Clear separation between governance decisions and operational actions
- **Emergency vs Normal**: Emergency roles have time-limited powers with automatic sunset clauses
- **Oracle Security**: Multi-signature requirements for NAV updates with emergency override capability

### Access Control Patterns
- **Principle of Least Privilege**: Each role has minimal required permissions
- **Role Escalation**: Emergency roles can temporarily override normal operations
- **Automatic Sunset**: Emergency powers have automatic expiration mechanisms

### Audit Trail
- **Event Logging**: All role-based actions emit events for audit trail
- **Timestamp Tracking**: All actions are timestamped for compliance
- **Reference Numbers**: Legal and operational actions include reference numbers

## Compliance Requirements

### Institutional Standards
- **Multi-Signature**: Critical operations require multiple signers
- **Time Limits**: Emergency powers have automatic expiration
- **Audit Trail**: Complete logging of all administrative actions

### Regulatory Alignment
- **Basel III**: Role separation aligns with operational risk requirements
- **MiFID II**: Clear governance structure for investor protection
- **Local Regulations**: South African CFI framework compliance

## Conclusion

The BRICS Protocol implements a comprehensive role-based access control system designed for institutional-grade security and governance. The role hierarchy ensures proper separation of concerns while enabling effective crisis management and emergency response.

**Status**: Role matrix is complete and ready for audit review.
