# BRICS Protocol Core Specification

## Overview
BRICS Protocol is a super-senior tranche DeFi protocol with emergency systems, NAV oracle, and sovereign backstop capabilities.

## §1. Protocol Architecture

### Core Components
- **IssuanceControllerV3**: Mint/redeem logic with emergency controls
- **TrancheManagerV2**: Detachment band management
- **NAVOracleV3**: On-chain NAV with quorum and degradation
- **ConfigRegistry**: Global risk parameters and emergency levels
- **MemberRegistry**: Membership gating and pool whitelisting
- **BRICSToken**: ERC-20 token with transfer restrictions

### Emergency System
- **4-tier levels**: NORMAL, YELLOW, ORANGE, RED
- **Escalating restrictions**: Issuance caps, buffer requirements, cooldowns
- **Sovereign backstop**: 105% soft-cap expansion capability

## §2. Membership & Transfer Control

### Requirements
- All token transfers require sender/receiver to be members or whitelisted pools
- Membership controlled by OperationalAgreement contract
- Pool whitelisting for institutional access

### Implementation
- BRICSToken._update() enforces transfer restrictions
- MemberRegistry provides canSend/canReceive checks
- IssuanceController checks membership before minting

## §3. Per-Sovereign Soft-Cap Damping

### Requirements
- Each sovereign has utilization cap and haircut parameters
- Effective capacity = cap * (1 - haircutBps/10000)
- Linear damping slope between softCap and hardCap
- Emergency pause disables minting

### Parameters
- `utilCapBps`: Utilization cap in basis points
- `haircutBps`: Haircut applied to capacity
- `weightBps`: Sovereign weight in portfolio
- `enabled`: Flag to gate capacity

## §4. NAV Redemption Lane

### Requirements
- NAV window open/close controls
- Events: NAVRequestCreated, NAVSettled
- BURNER_ROLE executor at settlement
- Views: nextCutoffTime, pendingBy(account), claimStatus(id)

### Implementation
- RedemptionClaim contract for NAV-based redemptions
- Time-based cutoff windows
- Settlement by authorized burners

## §5. Oracle Signer & Degradation

### Requirements
- EIP-712 signature verification
- Valid signature, unexpired timestamp, monotonic nonce
- DEGRADED mode: mints off, redemptions on, configs frozen
- Recovery procedures for oracle restoration

### Implementation
- NAVOracleV3 with quorum system
- Degradation mode with stale NAV handling
- Emergency signer override capability

## §6. Cross-Sovereign Configuration

### Requirements
- CRUD operations for sovereign configurations
- Validation: bps ≤ 10000, unknown sovereign reverts
- Maintain insertion order
- "enabled" flag gating capacity

### Implementation
- ConfigRegistry sovereign registry
- SovereignCfg struct with all parameters
- Events for add/update operations

## §7. Security & Access Control

### Roles
- **GOV_ROLE**: Governance decisions
- **ECC_ROLE**: Emergency Control Committee
- **OPS_ROLE**: Operational actions
- **MINTER_ROLE**: Token minting
- **BURNER_ROLE**: Token burning

### Security Features
- ReentrancyGuard on critical paths
- Custom errors for gas optimization
- Role-based access control
- Anti-sybil measures with daily caps

## §8. Emergency Procedures

### Level Escalation
- **NORMAL**: Standard operations
- **YELLOW**: Increased buffer requirements
- **ORANGE**: Reduced issuance rates, extended cooldowns
- **RED**: Issuance halted, sovereign backstop available

### Recovery
- Governance attestation for critical changes
- Timelock considerations for mainnet
- Emergency signer procedures
