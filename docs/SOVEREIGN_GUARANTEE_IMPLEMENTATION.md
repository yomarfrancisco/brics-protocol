# Sovereign Guarantee Implementation

## Overview

The BRICS Protocol's sovereign guarantee is a **sophisticated legal-financial infrastructure** that provides credit loss protection and liquidity backstop through sovereign-backed claims. This document details the complete implementation of the sovereign guarantee system.

## §1. Legal Framework Integration

### Master Guarantee Agreement Structure
- **PFMA Authority**: References Public Finance Management Act
- **ISDA-Style Terms**: Credit protection with defined events of default
- **Scope**: Guaranteed exposures, caps, conditions precedent
- **Timelines**: 7-day acknowledgment, 90-day payment window
- **Evidence Package**: Default definitions, cure periods, audit rights

### Sovereign Side Letters
- **Per-Pool Schedules**: Specific bank portfolios tied to master agreement
- **Governing Law**: South African law with expedited arbitration
- **Sovereign Immunity**: Limited waiver for guarantee obligations
- **Operational Protocol**: Data files, signatures, electronic service

## §2. Technical Implementation

### Core Contracts

#### ClaimRegistry.sol
**Purpose**: Legal milestone tracking and claim lifecycle management

**Key Functions**:
- `triggerClaim()` - ECC_ROLE initiates sovereign claim
- `serveNotice()` - OPS_ROLE serves formal notice to sovereign
- `recordAcknowledgment()` - OPS_ROLE records sovereign response
- `schedulePayment()` - OPS_ROLE schedules advance/settlement
- `recordSettlement()` - OPS_ROLE records final payment

**Claim Lifecycle**:
```
T0: Trigger (ECC) → T+7d: Notice (OPS) → T+7d: Acknowledgment (OPS) → T+90d: Settlement (OPS)
```

**Events for Auditors**:
- `ClaimTriggered(claimId, reason, baseLoss, coveredLoss)`
- `NoticeServed(claimId, dossierHash, jurisdiction, ts)`
- `Acknowledged(claimId, ts, refNo)`
- `ScheduledPayment(claimId, ts, amount)`
- `Settlement(claimId, ts, amount, refNo)`

#### TrancheManagerV2.sol Enhancements
**Tier 2 Expansion (106-108%)**:
- `expandToTier2()` - ECC_ROLE expands to 108% with claim validation
- `enforceTier2Expiry()` - ECC_ROLE enforces 14-day expiry
- `canExpandTier2()` - Validates buffer targets and advance requirements

**Integration Points**:
- ClaimRegistry validation for Tier 2 expansion
- Buffer target enforcement (IRB 12%, Pre-Tranche Buffer $8M)
- Advance requirement validation (50% minimum)

#### IssuanceControllerV3.sol Integration
**Sovereign Guarantee Checks**:
- Crisis issuance validation in RED state
- Sovereign guarantee availability verification
- Automatic blocking when no guarantee available

### Coverage Calculation

#### Loss Waterfall Formula
```
BaseLoss = max(0, L - FL - MZ)
CoveredLoss = min(BaseLoss, SG_avail)
Advance = min(k * ExpectedCoveredLoss, SG_avail)
```

**Where**:
- `L` = Realized loss on pool
- `FL` = Bank first-loss (up to 5% of N)
- `MZ` = Mezzanine (next 5% of N)
- `SG_avail` = Sovereign cap - utilized amount
- `k` = Advance factor (50-80% based on legal certainty)

#### Worked Example
```
Pool notional N = $200M
Realized loss L = $28M
Bank first-loss FL = $10M (5%)
Mezzanine MZ = $10M (5%)
Sovereign cap SG_cap = $180M (90%)

BaseLoss = max(0, 28 - 10 - 10) = $8M
CoveredLoss = min($8M, $180M) = $8M
Advance at 60% = $8M * 0.6 = $4.8M
```

## §3. Trigger Conditions

### Primary (Credit) Triggers
1. **Loss Waterfall Breach**:
   - Realized/adjudicated losses > 10% of pool notional
   - Bank first-loss (0-5%) exhausted
   - Mezzanine (5-10%) exhausted or committed

2. **Event of Default Bundle**:
   - ≥X% loans in default
   - Expected loss (EL + stressed LGD) implies mezzanine exhaustion

### Secondary (Liquidity Backstop) Triggers
**Only in RED state**:
3. **IRB Shortfall**: Persists ≥48h below RED target (12%) while monthly queue > Y% of outstanding
4. **Pre-Tranche Buffer**: < $5M for ≥48h and ECC confirms liquidity crisis

### Process Triggers
- **ECC_ROLE** (plus NASASA + Old Mutual in RED) calls `SovereignClaimToken.unlockClaim(reason)`
- **Off-chain legal service** starts claim process

## §4. Crisis Integration (105-108% Expansion)

### Tier 1 Expansion (105%)
**Requirements**:
- Emergency Level: RED
- Sovereign guarantee confirmed
- ECC approval + DAO ratification (≥67% support)
- 7-day window (extendable +14d if >67% support)

**Auto-revert**: Max 30 days unless re-ratified

### Tier 2 Expansion (106-108%)
**Requirements**:
- All Tier 1 requirements met
- Formal notice served (proof recorded on-chain)
- Bridge facility executed (Old Mutual or sovereign advance) ≥ 50% of CoveredLoss
- IRB at 12% and Pre-Tranche Buffer ≥ $8M
- Supermajority DAO (≥75%) + ECC + NASASA + Underwriter multisig

**Auto-revert**: Max 14 days windows, renewable only if legal milestones progress

### Issuance Rules in Crisis
- **Issuance halted** in RED (already in spec)
- **Redemptions continue** via buffers and monthly claims
- **AMM slippage bounds** widen as per ConfigRegistry

## §5. Operational Procedures

### Claim Initiation (T0)
1. **ECC detects breach** and records in EmergencyLevel.RED
2. **SBT.unlockClaim()** called with reason
3. **Ops prepare Claim Dossier**: loan schedules, default notices, audit trail
4. **Treasury sets bridge plan**: Pre-Tranche Buffer + IRB increases

### Formal Notice (T0 + 7 days)
1. **Legal serves notice** to sovereign counterparty
2. **Off-chain posts hash** to chain (ClaimRegistry.emitNotice)
3. **ClaimRegistry.serveNotice()** called with dossier hash

### Execution Window (T0 + up to 90 days)
1. **Sovereign reviews** with periodic status updates
2. **Optional advance** (50-80% of CoveredLoss) wired by sovereign or Old Mutual
3. **Final settlement**: sovereign wires to SPV Treasury → Treasury.fund()

### Buffer Coordination
- **Sovereign guarantee** activates when buffers < 30%
- **Emergency funding cascade**: Old Mutual → Sovereign → Emergency DAO
- **Automatic sovereign claim** activation on buffer depletion

## §6. Testing Scenarios

### Legal Milestone Tracking
- ✅ Claim trigger with dossier hash
- ✅ Formal notice serving
- ✅ Sovereign acknowledgment recording
- ✅ Payment scheduling and settlement
- ✅ Claim lifecycle completion

### Tier 2 Expansion Validation
- ✅ Buffer target enforcement (IRB 12%, Pre-Tranche Buffer $8M)
- ✅ Advance requirement validation (50% minimum)
- ✅ Legal milestone progression checks
- ✅ Auto-expiry enforcement (14 days)

### Crisis Integration
- ✅ Issuance blocking when no sovereign guarantee
- ✅ Tier 1 expansion (105%) with governance
- ✅ Tier 2 expansion (106-108%) with full validation
- ✅ Coverage calculation accuracy

## §7. Security Considerations

### Access Control
- **ECC_ROLE**: Claim triggering and crisis management
- **OPS_ROLE**: Legal milestone recording and operational procedures
- **GOV_ROLE**: Sovereign guarantee confirmation and governance

### Validation Checks
- **Buffer targets**: Enforced before Tier 2 expansion
- **Advance requirements**: Minimum 50% before expansion
- **Legal milestones**: Sequential progression enforced
- **Time windows**: Auto-expiry prevents indefinite expansion

### Audit Trail
- **On-chain events**: Complete claim lifecycle tracking
- **IPFS integration**: Dossier hash storage for legal documents
- **Timestamp validation**: All milestones time-stamped
- **Reference numbers**: Sovereign reference tracking

## §8. Integration Points

### External Systems
- **Legal Service**: Off-chain claim processing and document management
- **Old Mutual**: Bridge facility and advance funding
- **NASASA**: Regulatory oversight and crisis coordination
- **Sovereign Counterparties**: Direct guarantee execution

### On-Chain Coordination
- **Treasury**: Settlement receipt and buffer management
- **Pre-Tranche Buffer**: Emergency liquidity coordination
- **ConfigRegistry**: Emergency level and parameter management
- **TrancheManager**: Detachment band expansion control

## §9. Success Metrics

### Technical Performance
- **Claim processing time**: < 7 days notice, < 90 days settlement
- **Legal milestone accuracy**: 100% on-chain tracking
- **Buffer coordination**: Seamless emergency funding cascade

### Financial Performance
- **Coverage accuracy**: 90% loss coverage maintained
- **Advance efficiency**: 50-80% advance within 30 days
- **Crisis expansion**: 105-108% detachment when needed

### Operational Performance
- **Legal compliance**: 100% regulatory requirement adherence
- **Audit readiness**: Complete on-chain audit trail
- **Crisis response**: < 48h trigger to notice serving

## §10. Future Enhancements

### Multi-Sovereign Support
- **Per-sovereign ledgers**: SG_cap[sov], SG_util[sov]
- **Cross-fill mechanisms**: Backup sovereign routing
- **Governance coordination**: Multi-sovereign approval processes

### Enhanced Legal Integration
- **EIP-712 signatures**: Legal document signing
- **Automated compliance**: Regulatory requirement checking
- **Dispute resolution**: On-chain arbitration support

### Advanced Crisis Management
- **Predictive triggers**: AI-driven early warning systems
- **Dynamic expansion**: Real-time detachment adjustment
- **Coordinated response**: Multi-protocol crisis coordination

---

**Note**: This implementation provides the foundation for institutional-grade sovereign guarantee infrastructure. The legal framework and operational procedures must be established in parallel with technical deployment.
