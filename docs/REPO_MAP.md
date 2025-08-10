# BRICS Protocol Repository Map

## Repository Structure Overview

```
brics-protocol/
├── contracts/                 # Smart contracts
│   ├── BRICSToken.sol        # ERC-20 token with transfer restrictions
│   ├── IssuanceControllerV3.sol  # Core mint/redeem logic
│   ├── ConfigRegistry.sol    # Global risk parameters & emergency levels
│   ├── MemberRegistry.sol    # Membership gating & pool whitelisting
│   ├── MezzanineVault.sol    # ERC-4626 vault for mezzanine tranche
│   ├── NAVOracleV3.sol       # On-chain NAV with quorum & degradation
│   ├── TrancheManagerV2.sol  # Detachment band management
│   ├── PreTrancheBuffer.sol  # Instant redemption buffer
│   ├── Treasury.sol          # Funds custody
│   ├── RedemptionClaim.sol   # NAV-based redemption claims
│   ├── OperationalAgreement.sol  # Membership management
│   ├── SovereignClaimToken.sol   # Sovereign backstop claims
│   └── mocks/                # Mock contracts for testing
├── frontend/                 # Frontend application
│   └── brics-ui/            # React/Next.js UI
├── deploy/                   # Deployment scripts
├── scripts/                  # Utility scripts
├── tasks/                    # Hardhat operational tasks
├── test/                     # Test suite
├── docs/                     # Documentation
└── offchain/                 # Off-chain components
```

## Contract Responsibilities

### Core Protocol Contracts

#### BRICSToken.sol
- **Purpose**: ERC-20 token with transfer restrictions
- **Key Functions**: mint(), burn(), _update()
- **Roles**: MINTER_ROLE, BURNER_ROLE
- **SPEC Sections**: §2 (Membership & Transfer Control)
- **Dependencies**: MemberRegistry

#### IssuanceControllerV3.sol
- **Purpose**: Core mint/redeem logic with emergency controls
- **Key Functions**: mintFor(), requestRedeemOnBehalf(), canIssue()
- **Roles**: OPS_ROLE, GOV_ROLE, ECC_ROLE
- **SPEC Sections**: §3 (Per-Sovereign Soft-Cap Damping), §4 (NAV Redemption Lane), §5 (Oracle Signer & Degradation)
- **Dependencies**: BRICSToken, ConfigRegistry, TrancheManagerV2, NAVOracleV3, Treasury, PreTrancheBuffer

#### ConfigRegistry.sol
- **Purpose**: Global risk parameters and emergency levels
- **Key Functions**: setEmergencyLevel(), addSovereign(), getCurrentParams()
- **Roles**: GOV_ROLE, ECC_ROLE
- **SPEC Sections**: §6 (Cross-Sovereign Configuration), §8 (Emergency Procedures)
- **Dependencies**: None

#### MemberRegistry.sol
- **Purpose**: Membership gating and pool whitelisting
- **Key Functions**: setMember(), setPool(), canSend(), canReceive()
- **Roles**: REGISTRY_ADMIN
- **SPEC Sections**: §2 (Membership & Transfer Control)
- **Dependencies**: OperationalAgreement

#### MezzanineVault.sol
- **Purpose**: ERC-4626 vault for mezzanine tranche
- **Key Functions**: deposit(), withdraw(), redeem()
- **Roles**: GOV_ROLE
- **SPEC Sections**: ERC-4626 standard implementation
- **Dependencies**: ERC-4626 standard

### Supporting Contracts

#### NAVOracleV3.sol
- **Purpose**: On-chain NAV with quorum and degradation modes
- **Key Functions**: navRay(), setNAV(), toggleDegradationMode()
- **Roles**: ORACLE_ADMIN, MODEL_SIGNER, EMERGENCY_SIGNER
- **SPEC Sections**: §5 (Oracle Signer & Degradation)

#### TrancheManagerV2.sol
- **Purpose**: Detachment band management and soft-cap expansion
- **Key Functions**: raiseDetachment(), emergencyExpandToSoftCap()
- **Roles**: GOV_ROLE, ECC_ROLE
- **SPEC Sections**: §3 (Per-Sovereign Soft-Cap Damping)

#### PreTrancheBuffer.sol
- **Purpose**: Instant redemption buffer for immediate liquidity
- **Key Functions**: instantRedeem(), availableInstantCapacity()
- **Roles**: None (called by IssuanceController)
- **SPEC Sections**: §4 (NAV Redemption Lane)

#### Treasury.sol
- **Purpose**: Funds custody for issuance/redemption
- **Key Functions**: fund(), pay(), balance()
- **Roles**: GOV_ROLE, PAY_ROLE
- **SPEC Sections**: §7 (Security & Access Control)

## Frontend Structure

#### frontend/brics-ui/
- **Purpose**: React/Next.js user interface
- **Key Components**: ProtocolStatus, MintRedeem, WalletButton
- **SPEC Sections**: §2, §4 (UI indicators for membership and NAV redemptions)

## Deployment & Scripts

#### deploy/
- **Purpose**: Sequenced deployment scripts
- **Files**: 00_env.ts, 01_core.ts, 02_finance.ts, etc.
- **SPEC Sections**: All (deployment configuration)

#### scripts/
- **Purpose**: Utility and operational scripts
- **Files**: deploy.ts, monitor.ts, oracleUpdate.ts, etc.
- **SPEC Sections**: All (operational procedures)

#### tasks/
- **Purpose**: Hardhat operational tasks
- **Files**: governance.ts, emergencyExpandSoftCap.ts, etc.
- **SPEC Sections**: §6, §8 (governance and emergency procedures)

## Test Structure

#### test/
- **Purpose**: Comprehensive test suite
- **Files**: issuance.spec.ts, emergency.spec.ts, gating.spec.ts
- **SPEC Sections**: All (test coverage for all specifications)

## Documentation

#### docs/
- **Purpose**: Protocol documentation and specifications
- **Files**: BRICS_SPEC_CORE.md, TRACEABILITY.md, REPO_MAP.md
- **SPEC Sections**: All (documentation and traceability)

## Implementation Status

### ✅ Fully Implemented
- §2: Membership & Transfer Control
- §7: Security & Access Control
- §8: Emergency Procedures (partial)

### 🔄 Partially Implemented
- §3: Per-Sovereign Soft-Cap Damping (missing damping logic)
- §6: Cross-Sovereign Configuration (missing enabled flag)

### ❌ Not Implemented
- §4: NAV Redemption Lane (missing window controls)
- §5: Oracle Signer & Degradation (missing EIP-712 verification)

## Next Implementation Priorities
1. Complete §3: Per-sovereign soft-cap damping logic
2. Implement §4: NAV redemption lane controls
3. Add §5: EIP-712 signature verification
4. Complete §6: Sovereign enabled flag
