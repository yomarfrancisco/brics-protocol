# BRICS Protocol — AI Developer Context

## Purpose
On-chain synthetic securitization system. BRICS ERC-20 = super-senior tranche (100–102%, expandable to 105% in RED). Below it: bank first-loss (0–5%), mezzanine (5–10%, ERC-4626 vault), sovereign guarantee (10–100%, multi-sovereign capable).

## Core Contracts & Roles

### Governance & Membership
- **OperationalAgreement.sol** — Administers member registry; roles: NASASA_ROLE, SPV_ROLE, OPERATOR_ROLE.
- **MemberRegistry.sol** — Tracks isMember/isWhitelistedPool; only registrar can update.

### Core Protocol
- **BRICSToken.sol** — ERC-20, gated transfers; MINTER_ROLE, BURNER_ROLE.
- **ConfigRegistry.sol** — Emergency params; NORMAL/YELLOW/ORANGE/RED; controls AMM slippage, IRB %, issuance rate, max detachment.
- **NAVOracleV3.sol** — Quorum-signed NAV; degradation mode; emergency signers (NASASA, Old Mutual).
- **TrancheManagerV2.sol** — Maintains detachment band; guarded raises; RED state soft-cap to 105% with sovereign confirmation.

### Liquidity & Risk Management
- **PreTrancheBuffer.sol** — USDC buffer for instant redeems; $10M target; $50K/member/day cap.
- **IssuanceControllerV3.sol** — canIssue() checks tail corr, sov util, IRB, caps; mints at NAV; redemption queue + instant via Pre-Tranche Buffer.
- **RedemptionClaim.sol** — ERC-1155 claims for monthly NAV; freeze period varies by emergency level.
- **MezzanineVault.sol** — ERC-4626, whitelisted depositors; 5-year reinvest lock.

### Sovereign Guarantee System
- **SovereignClaimToken.sol** — SBT; unlock/exercise triggers off-chain legal process.
- **ClaimRegistry.sol** — Tracks sovereign claim lifecycle; legal milestone management; Tier 2 expansion validation.

## Off-chain Components
- **Risk ingestion API** — aggregate bank metrics: tail corr, sovereign util, buffer ratio.
- **Emergency assessment engine** — returns NORMAL/YELLOW/ORANGE/RED.
- **Buffer calculator** — IRB target by state; sovereign bridge sizing.
- **Degraded NAV logic** — last-known NAV + growth cap + stress multiplier.

## Emergency State Logic
- **NORMAL**: IRB 3%, AMM ±0.5%, issuance 100%.
- **YELLOW**: IRB 5%, AMM ±1.5%.
- **ORANGE**: IRB 8%, AMM ±2.5%, issuance 50%.
- **RED**: IRB 12%, AMM ±5%, issuance halt, detachment up to 105% (requires sovereign confirmation).

## Sovereign Claim Flow
- **Trigger**: junior layers (0–10%) exhausted OR systemic liquidity failure in RED after buffers.
- **Coverage**: losses >10% up to 90% of pool notional (multi-sovereign capable).
- **Timeline**: unlock (T0) → notice ≤7d → execution ≤90d; optional 50–80% advance with assignment of proceeds.

## Liquidity Waterfall
1. **Pre-Tranche Buffer** (instant, daily cap)
2. **IRB/AMM** (instant, slippage-bounded)
3. **Monthly NAV claim** (ERC-1155, T+5)
4. **Sovereign claim bridge** (loss events only)

## Guardrails
- **Halt issuance** if RED, IRB < target, tail corr > cap, sov util > cap, or super-senior cap exceeded.
- **Detachment raises** in +100 bps steps, ≥24h apart, unless RED soft-cap rule applies.
- **Auto-revert** to ratified detachment if governance misses deadlines.

## Key APIs (FastAPI endpoints)
- `/nav/latest` → {nav, ts, model_hash}
- `/emergency/level` → {level, triggers, time_in_state}
- `/emergency/buffers` → {pre_tranche, irb, targets, health}
- `/gateway/mint` (member-gated)
- `/gateway/redeem` → {claim_id, amount, strike_ts}
- `/claim/:id` → {owner, amount, strike_ts, settled}

## Development Priorities
- **Maintain invariants** for issuance, redemption, emergency states.
- **Ensure sovereign utilisation** and tail correlation checks gate minting.
- **Preserve member-gating** on all token transfers and redemptions.
- **Integrate off-chain emergency level updates** into ConfigRegistry on-chain params.

## Institutional Requirements
- **Legal Framework**: PFMA authority, ISDA-style terms, enforceable sovereign guarantees
- **Crisis Resilience**: Emergency response systems, buffer coordination, sovereign activation
- **Multi-Sovereign Coordination**: Cross-border risk diversification, legal frameworks
- **Audit Readiness**: Complete on-chain audit trails, legal milestone tracking
- **Regulatory Alignment**: Basel III, MiFID II compliance considerations

## Capital Stack
```
BRICS Super-Senior (100-108% detachment)
    ↓
Instant Redemption Buffer (3-12% scaling)
    ↓
Pre-Tranche Buffer ($10M liquid)
    ↓
Sovereign Guarantee (10-100%, multi-sovereign)
    ↓
Mezzanine Tranche (5-10%, ERC-4626 vault)
    ↓
Bank Equity (0-5% first loss)
```

## Key Innovation
**Adaptive Sovereign Credit Infrastructure** with:
- Multi-layered capital stack with real-time crisis response
- Dynamic detachment expansion (105-108%) with sovereign confirmation
- Multi-sovereign coordination across BRICS nations
- Legal framework integration (PFMA/ISDA compliance)

## Value Proposition
- **For Banks**: Unlock 20–30% capital efficiency without selling assets
- **For Investors**: Access emerging market credit with sovereign backing, crisis protection
- **For Sovereigns**: Monetise credit capacity through structured risk transfer
- **For the System**: Create liquid markets for previously illiquid emerging market assets

## Result
**BRICS runs like a stablecoin but survives like a AAA bond** — an adaptive sovereign credit infrastructure capable of scaling across multiple nations, dynamically hedging sovereign exposures, and enabling the largest capital efficiency transformation in emerging market banking history.

---

## Usage Instructions for AI Assistants

When working on this project, always:

1. **Reference this context** to understand the institutional-grade requirements
2. **Consider crisis resilience** in every development decision
3. **Maintain legal framework compliance** for sovereign guarantee integration
4. **Preserve audit trail integrity** for all state changes
5. **Think institutional-grade, not DeFi-native**

**Key Question**: How does this change affect crisis response, sovereign guarantee activation, or legal framework compliance?

---

## Contract Interaction Map

### 1. High-Level Flow

```
[Investor Wallet] 
   ↕ (mint/redeem calls via)
[NASASAGateway] 
   ↔ IssuanceControllerV3 
       ↔ BRICSToken (mint/burn)
       ↔ Treasury (USDC transfers)
       ↔ PreTrancheBuffer (instant redeems)
       ↔ RedemptionClaim (monthly claims)
       ↔ TrancheManagerV2 (cap checks, detachment)
       ↔ ConfigRegistry (emergency params)
       ↔ NAVOracleV3 (NAV pricing)

[Banks] → Aggregate risk data → Off-chain Risk Engine → ConfigRegistry & Emergency State updates on-chain
```

### 2. Contract Interaction Details

#### OperationalAgreement.sol
- **Writes to**: MemberRegistry.setMember, MemberRegistry.setPool
- **Purpose**: Grants/revokes membership & pool whitelist
- **Called by**: NASASA, SPV, approved Operators

#### MemberRegistry.sol
- **Reads**: isMember, isWhitelistedPool
- **Writes**: setMember, setPool
- **Used by**: BRICSToken (_update), PreTrancheBuffer, RedemptionClaim for transfer gating

#### BRICSToken.sol
- **Reads from**: MemberRegistry (transfer gating)
- **Writes**: ERC-20 balances via _mint, _burn
- **Called by**: IssuanceControllerV3 (mint/burn)

#### ConfigRegistry.sol
- **Reads from**: Many contracts (getCurrentParams, emergencyLevel)
- **Writes**: setEmergencyLevel, param setters
- **Called by**: Off-chain emergency scripts, governance

#### NAVOracleV3.sol
- **Reads**: NAV values in IssuanceControllerV3, TrancheManagerV2
- **Writes**: setNAV (multi-sig signed), emergencySetNAV (emergency signers)
- **Feeds**: Live NAV to mint/redeem logic

#### TrancheManagerV2.sol
- **Reads from**: ConfigRegistry.emergencyLevel(), oracle.lastTs()
- **Writes**: adjustSuperSeniorCap, raiseBRICSDetachment, emergencyExpandToSoftCap
- **Called by**: IssuanceControllerV3 (cap checks), governance (detachment changes)

#### PreTrancheBuffer.sol
- **Reads**: MemberRegistry.isMember
- **Writes**: USDC transfers to members for instant redeems
- **Called by**: IssuanceControllerV3 (process instant redemption)

#### IssuanceControllerV3.sol
- **Reads from**: NAVOracleV3, ConfigRegistry, TrancheManagerV2, Treasury, PreTrancheBuffer
- **Writes**: Mint BRICSToken, burn BRICSToken, issue RedemptionClaim
- **Core logic**: Validates canIssue() conditions (tail corr, sov util, IRB %, caps)
- **Called by**: NASASAGateway for member interactions

#### RedemptionClaim.sol
- **Reads**: MemberRegistry.isMember, ConfigRegistry.emergencyLevel()
- **Writes**: Mint/burn ERC-1155 claims
- **Called by**: IssuanceControllerV3 when processing monthly NAV redemptions

#### MezzanineVault.sol
- **Independent ERC-4626 vault with whitelist**
- **Feeds**: Underwriter reinvestment returns to buffers

#### SovereignClaimToken.sol
- **Independent ERC-721 SBT**
- **Called by**: Governance to unlock/exercise claim after loss events
- **Off-chain legal execution required to settle**

#### Treasury.sol
- **Reads**: balance()
- **Writes**: pay() and fund()
- **Called by**: IssuanceControllerV3 for USDC custody, buffer requirements

### 3. Off-chain → On-chain Integration

#### Off-chain Risk Engine
- **Reads**: aggregate loan sector PD, exposure, tenor, size buckets, sovereign util
- **Calculates**: tail correlation, emergency level, buffer requirements
- **Writes**: ConfigRegistry.setEmergencyLevel() and param updates

#### Oracle Feed
- **Off-chain model → NAVOracleV3.setNAV() (multi-sig)**
- **Emergency mode**: NAVOracleV3.emergencySetNAV() by NASASA + Old Mutual

### 4. Key Call Sequences

#### Mint BRICS
```
Investor → NASASAGateway → IssuanceControllerV3.mintFor()
  ↳ Checks: canIssue() [ConfigRegistry, TrancheManagerV2, NAVOracleV3, Treasury]
  ↳ Transfers USDC to Treasury
  ↳ Mints BRICSToken to investor
```

#### Instant Redeem
```
Investor → NASASAGateway → IssuanceControllerV3.requestRedeemOnBehalf()
  ↳ Checks PreTrancheBuffer capacity
  ↳ Burns BRICSToken
  ↳ Transfers USDC to investor
```

#### Monthly NAV Redeem
```
Investor → NASASAGateway → IssuanceControllerV3.requestRedeemOnBehalf()
  ↳ If not instant: issues RedemptionClaim ERC-1155
  ↳ Settlement after strike date (T+5)
```

#### Sovereign Claim Event
```
ECC/Gov triggers SovereignClaimToken.unlockClaim()
  ↳ Off-chain legal process: 7d notice, 90d execution
  ↳ Settlement USDC to Treasury
  ↳ Buffers and redemptions replenished
```

---

## ASCII Contract Graph (Visual Architecture)

```
                         ┌──────────────────────┐
                         │   Off-chain Risk     │
                         │   Engine (FastAPI)   │
                         └──────────┬───────────┘
                                    │ writes params (GOV/ECC)
                                    ▼
                         ┌──────────────────────┐
                         │   ConfigRegistry     │◄─────────────┐
                         │  (emergency/params)  │              │ reads
                         └──────────┬───────────┘              │
                                    │                          │
                                    │ reads                    │
                                    ▼                          │
┌───────────────┐   reads    ┌──────────────────────┐   reads  │
│ TrancheManager│◄──────────►│    NAVOracleV3       │◄────────┘
│     V2        │            │ (nav, quorum, degr.) │
└──────┬────────┘            └──────────┬───────────┘
       │                                 ▲
       │ reads cap/ detachment           │ setNAV (multisig) / emergencySetNAV
       │                                 │
       │                                 │
       ▼                                 │
┌───────────────┐   reads/uses   ┌───────┴─────────┐
│ Issuance      │───────────────►│   Treasury      │
│ Controller V3 │                │    (USDC)       │
│ (mint/redeem) │◄───────────────│  balance/pays   │
└───┬─────┬─────┘                └───────┬─────────┘
    │     │                               │
    │     │ burns/mints                   │ USDC transfer
    │     │                               │
    ▼     ▼                               │
┌───────────────┐                   ┌─────▼─────────┐
│  BRICSToken   │                   │ PreTrancheBuf │
│ (ERC20 gated) │                   │  ($10M, IR)   │
└──────┬────────┘                   └─────┬─────────┘
       │ transfer-gated by                │ instant payouts
       ▼                                  │ (daily caps)
┌───────────────┐                         │
│ MemberRegistry│◄──────────────┐         │
│ (isMember/    │               │         │
│  pools)       │               │         │
└──────┬────────┘               │         │
       ▲                        │         │
       │ setMember/setPool      │         │
       │                        │         │
┌──────┴────────┐               │         │
│ Operational   │               │         │
│ Agreement     │               │         │
│ (NASASA/SPV)  │───────────────┘         │
└───────────────┘                         │
                                          │ fallback → monthly claims
                                          ▼
                                   ┌───────────────┐
                                   │ Redemption    │
                                   │  Claim (1155) │
                                   └──────┬────────┘
                                          │ settle/burn at strike (T+5)
                                          ▼
                                   ┌───────────────┐
                                   │  Investor     │
                                   │   Wallet      │
                                   └───────────────┘


          ┌──────────────────────── Sovereign / Underwriter Layer ───────────────────────┐
          │                                                                              │
          │  ┌──────────────────────┐         (legal unlock/exercise)        ┌────────┐ │
          │  │ SovereignClaimToken  │◄───────────────────────────────────────│  ECC   │ │
          │  │   (SBT, non-xfer)    │                                         └────────┘ │
          │  └──────────┬───────────┘                                                 │  │
          │             │ exercise → off-chain legal, funds → Treasury.fund()         │  │
          │             ▼                                                             │  │
          │  ┌──────────────────────┐              reinvest/flows to buffers           │  │
          │  │  MezzanineVault      │──────────────────────────────────────────────────┘  │
          │  │   (ERC-4626)         │                                                     │
          │  └──────────────────────┘                                                     │
          └───────────────────────────────────────────────────────────────────────────────┘
```

### Legend
- **Solid arrow (→)**: function call / write
- **Double arrow (↔)**: mutual read/write or polling relationship
- **Dashed box**: conceptual grouping (sovereign/underwriter layer)
- **Reads**: contract pulls state from target
- **Writes**: mutating calls (role-gated)

### Read/Write Matrix (Quick Reference)
- `OperationalAgreement` → writes `MemberRegistry`
- `MemberRegistry` → read by `BRICSToken`, `PreTrancheBuffer`, `RedemptionClaim`
- `BRICSToken` ← minted/burned by `IssuanceControllerV3`; enforces gated `_update()` via `MemberRegistry`
- `ConfigRegistry` ← written by governance/off-chain scripts; read by `IssuanceControllerV3`, `TrancheManagerV2`, `RedemptionClaim`
- `NAVOracleV3` ← written by signer quorum / emergency signers; read by `IssuanceControllerV3`, `TrancheManagerV2`
- `TrancheManagerV2` ↔ reads `ConfigRegistry`, `NAVOracleV3.lastTs()`; exposes detachment/cap to `IssuanceControllerV3`
- `PreTrancheBuffer` ← called by `IssuanceControllerV3` for instant redeems; reads `MemberRegistry`
- `Treasury` ↔ `IssuanceControllerV3` for USDC custody & IRB checks
- `RedemptionClaim` ← minted/settled by `IssuanceControllerV3`; reads `ConfigRegistry` (freeze) & `MemberRegistry`
- `MezzanineVault` → off-chain ops/treasury for reinvest to buffers
- `SovereignClaimToken` ← unlocked/exercised by ECC/GOV; settlement wires to `Treasury`

### Critical Sequences (Compact)

#### Mint
1. Gateway → `IssuanceControllerV3.mintFor(to, usdc, tailPpm, sovBps)`
2. IC checks: `ConfigRegistry.getCurrentParams()`, `TrancheManagerV2.superSeniorCap()`, `NAVOracleV3.navRay()`, `Treasury.balance()`
3. `Treasury.fund(usdc)` (xferFrom) → `BRICSToken.mint(to, out)`

#### Instant Redeem
1. Gateway → `IssuanceControllerV3.requestRedeemOnBehalf(user, amt)`
2. If `PreTrancheBuffer.availableInstantCapacity(user) ≥ amt`:
   - `PreTrancheBuffer.instantRedeem(user, amt)` → `BRICSToken.burn(user, amt)`

#### Monthly Redeem
- Else: `RedemptionClaim.mintClaim(user, strikeTs, amt)` → settle T+5 via IC ops path

#### Detachment Raise / Soft-cap
- ECC/GOV → `TrancheManagerV2.raiseBRICSDetachment(newLo,newHi)` (step rules)  
- RED + sovereign confirmed → `emergencyExpandToSoftCap()` → 105%

#### Oracle Degradation
- If stale: `NAVOracleV3.toggleDegradationMode(true)` → reads degraded NAV; emergency signers may `emergencySetNAV`

#### Sovereign Claim
- ECC unlocks: `SovereignClaimToken.unlockClaim(reason)`  
- Off-chain legal → settlement funds → `Treasury.fund(amount)` → ops refill buffers & settle claims

### Off-chain Hooks (Minimal)
- **Risk engine script**:
  - Computes `level`, `ammMaxSlippageBps`, `instantBufferBps`, `maxIssuanceRateBps`
  - Calls `ConfigRegistry.setEmergencyLevel(level)` and optional `setEmergencyParams(level, …)`
- **Oracle signer**:
  - Posts `NAVOracleV3.setNAV(navRay, ts, nonce, sigs[])`
- **Ops CLI**:
  - `PreTrancheBuffer.fundBuffer(amount)`
  - `TrancheManagerV2.adjustSuperSeniorCap(cap)`
  - `IssuanceControllerV3.ratifyDetachment()` / `maybeRevertDetachment()`

### Invariants to Protect (Agent Hints)
- **Gating**: Every token transfer must pass `MemberRegistry` (BRICSToken `_update`).
- **Issuance**: Block if RED, IRB below target, tail corr or sov util exceed caps, or cap exceeded.
- **Detachment**: +100 bps steps, 24h cooldown; only RED allows 105% soft-cap with sovereign confirm.
- **Oracle**: If stale ⇒ use degradation; never mint on zero/stale NAV without degradation safeguards.
- **Claims**: ERC-1155 transfers respect freeze windows per emergency level.
