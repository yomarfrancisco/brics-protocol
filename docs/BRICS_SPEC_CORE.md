# BRICS Protocol Core Specification

## Overview
BRICS Protocol is an **institution-grade synthetic risk transfer protocol** for emerging market bank loan portfolios, featuring sovereign-backed, member-gated, yield-bearing tokens designed to run like stablecoins but survive like AAA bonds.

### Core Value Proposition
- **Problem**: Emerging market banks hold $2.3 trillion in performing loans but lack capital efficiency
- **Solution**: Adaptive sovereign credit infrastructure with real-time synthetic risk transfer
- **Token Structure**: Super-senior tranche (100-102% normal, expandable to 108% in catastrophic scenarios)

## §1. Protocol Architecture

### Capital Stack
1. **Bank Equity**: 0-5% (first loss)
2. **Mezzanine Tranche**: 5-10% (ERC-4626 vault, 5-year reinvestment lock)
3. **Sovereign Guarantee**: 10-100% (SBT-represented claim, 90-day execution)
4. **Pre-Tranche Buffer**: $10M liquid USDC (instant redemption support)
5. **BRICS Super-Senior**: 100-102% (expandable to 105% emergency, 108% catastrophic)

### Core Components
- **IssuanceControllerV3**: Mint/redeem logic with emergency controls
- **TrancheManagerV2**: Detachment band management (100-108%)
- **NAVOracleV3**: On-chain NAV with quorum and degradation
- **ConfigRegistry**: Global risk parameters and emergency levels
- **MemberRegistry**: Membership gating and pool whitelisting
- **BRICSToken**: ERC-20 token with transfer restrictions

### Emergency System
- **Normal Operations**: 100-103% detachment range
- **Emergency Mode**: 103-105% with supermajority approval (67%+)
- **Catastrophic Crisis**: 105-108% with super-emergency governance (75%+) and active sovereign guarantee
- **Oracle Degradation**: Automatic conservative failover with model-based static detachment

## §2. Membership & Transfer Control

### Requirements
- All token transfers require sender/receiver to be members or whitelisted pools
- Membership controlled by OperationalAgreement contract
- Pool whitelisting for institutional access (NASASA CFI gateway)

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

### Crisis Management
- **Normal**: Full capacity available
- **Emergency**: Reduced capacity with damping
- **Catastrophic**: Sovereign-specific restrictions

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

### Degradation Levels
- **NORMAL**: Standard operations
- **STALE**: >2h stale, 2% haircut
- **DEGRADED**: >6h stale, 5% haircut
- **EMERGENCY_OVERRIDE**: >24h stale, 10% haircut

### Implementation
- NAVOracleV3 with quorum system
- Degradation mode with stale NAV handling
- Emergency signer override capability (NASASA + Old Mutual)

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
- **EMERGENCY_ROLE**: Crisis response (72h max)
- **SUPER_EMERGENCY_ROLE**: Catastrophic crisis (NASASA + Old Mutual)

### Security Features
- ReentrancyGuard on critical paths
- Custom errors for gas optimization
- Role-based access control
- Anti-sybil measures with daily caps
- Emergency power grants with automatic sunset

## §8. Emergency Procedures

### Level Escalation
- **NORMAL**: Standard operations
- **YELLOW**: Increased buffer requirements
- **ORANGE**: Reduced issuance rates, extended cooldowns
- **RED**: Issuance halted, sovereign backstop available
- **CATASTROPHIC**: Super emergency powers (105-108% detachment)

### Crisis Response Scenarios
1. **Governance Deadlock**: 48h cooling, reduced quorum
2. **Oracle Failure**: Conservative static mode (102-103%)
3. **Buffer Depletion**: Auto-pause, emergency signers
4. **Catastrophic Crisis**: Super Emergency Role (72h max)

### Governance Threshold Matrix
|Action Type                |Normal|Emergency|Super Emergency|Crisis Authority  |
|---------------------------|------|---------|---------------|------------------|
|Parameter Changes          |51%   |60%      |N/A            |ECC               |
|Detachment Raise (Standard)|60%   |67%      |N/A            |ECC + DAO         |
|Detachment Raise (105%)    |67%   |67%      |N/A            |ECC + DAO         |
|Crisis Expansion (106-108%)|N/A   |N/A      |75%            |Super Emergency   |
|Oracle Override            |51%   |60%      |N/A            |ECC               |
|Emergency Funding          |60%   |67%      |75%            |ECC + Institutions|
|Sovereign Claim            |67%   |75%      |85%            |Legal + ECC       |

## §9. Buffer Coordination

### Buffer Architecture
- **Pre-Tranche Buffer**: $10M USDC (instant redemptions)
- **Treasury IRB**: 3-12% dynamic (monthly settlement)
- **Emergency DAO Reserve**: Crisis funding
- **Old Mutual Commitment**: $25M emergency buffer

### Emergency Funding Cascade
1. **Mezzanine profit redirection**
2. **Old Mutual top-up** ($5M minimum)
3. **Sovereign replenish fund**
4. **Emergency DAO treasury**
5. **Pause operations** (critical depletion)

### Stress Test Scenarios
- **Moderate Stress (40% redemptions)**: 30-day recovery
- **Severe Stress (70% redemptions + defaults)**: 90-day sovereign execution
- **Catastrophic (multiple failures)**: 7-14 days full restoration

## §10. Institutional Integration

### NASASA Framework
- **Regulatory**: CFI registration, PA authorization, FSCA license
- **Operational**: 99.5% uptime, 48h processing, 24/7 emergency
- **Financial**: $500K initial, $2M emergency participation

### Old Mutual Obligations
- **Capital**: $25M emergency buffer ($5M immediate, $20M extended)
- **Operational**: Emergency signer, risk committee, model validation
- **Reinvestment**: 100% fee reinvestment for 60 months
- **Performance**: <2h response time, >90% governance participation

### Sovereign Guarantee
- **Legal**: PFMA authority, ISDA framework, cross-border enforcement
- **Coverage**: 90% of notional, triggered at Bank+Mezz exhaustion
- **Timeline**: 48h trigger, 7d notice, 90d execution maximum

## §11. Regulatory Compliance

### Basel III Compliance
- **Capital Adequacy**: Super-senior tranche (100-108%)
- **Risk Weighting**: 20% for super-senior synthetic
- **Credit Risk Mitigation**: Sovereign guarantee + buffers
- **Operational Risk**: Multi-tier emergency procedures
- **Liquidity Coverage**: Pre-Tranche Buffer + IRB

### MiFID II Investor Protection
- **KYC**: NASASA CFI-grade gateway
- **Suitability**: Member tier classification
- **Risk Disclosure**: Emergency state alerts
- **Best Execution**: NAV-based pricing

## §12. Success Metrics

### Technical Performance
- System Uptime: >99.9%
- Emergency Response: <2 hours
- Oracle Health: <6 hour staleness
- Transaction Success: >99.5%

### Financial Performance
- Buffer Health: >50% combined ratio
- Portfolio Growth: 25% annual
- Fee Generation: 1.15% total
- Token Yield: 8.5% target

### Governance & Compliance
- Governance Participation: >67%
- Regulatory Compliance: Zero findings
- Emergency Preparedness: <15% drill failure rate
- Stakeholder Satisfaction: >90%
