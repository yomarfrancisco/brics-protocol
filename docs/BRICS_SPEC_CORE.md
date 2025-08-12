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

### NASASA Gateway & Dual-Lane System (v4.0)
- **NASASAGateway**: Single entry point for mint/redeem operations
- **RedemptionQueue**: FIFO queue for primary lane claims
- **InstantLane**: Pre-Tranche Buffer → AMM/PMM routing
- **PrimaryLane**: Monthly NAV strike with ERC-1155 claims

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
- NASASAGateway enforces member gating on all operations

## §3. Dual-Lane Redemption System (v4.0)

### Instant Lane
- **Source Priority**: Pre-Tranche Buffer → AMM/PMM (if buffer insufficient)
- **Daily Cap**: $50K per member (UTC reset)
- **AMM Bounds**: ConfigRegistry.getCurrentParams().ammMaxSlippageBps
- **Emergency Rules**: Slippage bounds scale with emergency level

**Call Graph**: `User → NASASAGateway.redeemInstant → InstantLane.instantRedeem → AMM`

### Primary Lane
- **Process**: Monthly NAV strike with ERC-1155 RedemptionClaim
- **Freeze Windows**: NORMAL/YELLOW 24h, ORANGE 48h, RED 72h pre-strike
- **Settlement**: T+5 window after strike processing
- **Pro-rata**: Applied if total exceeds ConfigRegistry.redeemCapBps (default 25%)

**Call Graph**: `User → NASASAGateway.queueRedemptionPrimary → RedemptionQueue.enqueue → ERC-1155 claim minted`

### Implementation
- NASASAGateway.redeem() routes to appropriate lane
- RedemptionQueue manages FIFO ordering for primary claims
- RedemptionClaim.sol handles ERC-1155 lifecycle
- ConfigRegistry controls freeze windows and caps

## §4. AMM/PMM Price Bounds (v4.0)

### Member-Only Access
- All swaps require MemberRegistry.isMember()
- Emergency pause disables AMM routing
- ConfigRegistry controls bounds per emergency level

### Bounds by Emergency Level
- **NORMAL**: ±0.5% (500 bps)
- **YELLOW**: ±1.5% (1500 bps)
- **ORANGE**: ±2.5% (2500 bps)
- **RED**: ±5% (5000 bps)

### Enforcement
- ConfigRegistry.getCurrentParams().ammMaxSlippageBps
- InstantLane enforces bounds during routing
- Emergency escalation triggers bound updates

## §5. Oracle Operations & Degradation (v4.0)

### Multi-Sig Signer Sets
- Quorum rotation with NASASA + Old Mutual
- Model hash versioning via NAVOracleV3.modelHash
- EIP-712 signature verification

### Degradation Triggers
- Stale > threshold (2h/6h/24h)
- Quorum unavailable
- Model mismatch

### Degraded NAV Formula
- lastKnownNAV + growthCap + stressMultiplier
- Emergency NAV path with conservative failover
- Static detachment during degradation

### Recovery Process
- Oracle restoration procedures
- Model hash validation
- Quorum re-establishment

## Mezzanine ERC-4626 Reinvest Lock

### Overview
The BRICS Protocol implements a 5-year lock mechanism for mezzanine assets through an ERC-4626 vault, ensuring long-term capital commitment while providing governance controls and emergency procedures.

### Core Components

#### MezzVault4626
- **Purpose**: ERC-4626 vault wrapper for mezzanine assets with lock semantics
- **Lock Duration**: 5 years (configurable via ConfigRegistry)
- **Grace Window**: 30 days (configurable via ConfigRegistry)
- **Lock Extension**: Deposits extend lock time monotonically

### Lock Policy

#### Lock Semantics
- **Initial Lock**: First deposit sets `minUnlockTs[account] = now + LOCK_DURATION`
- **Lock Extension**: Subsequent deposits extend lock if new unlock time is later
- **Monotonicity**: Lock time can only increase, never decrease
- **Grace Window**: 30-day window after unlock for full withdrawal with lock reset

#### Withdrawal Rules
- **Before Unlock**: All withdrawals blocked (revert `"MV/LOCKED"`)
- **At Unlock**: Full withdrawal allowed
- **Grace Window**: Full withdrawal resets lock to 0, partial withdrawals maintain lock
- **After Grace**: Withdrawals allowed but lock remains unchanged

#### Configuration
- **Lock Duration**: `ConfigRegistry.getUint(keccak256("mezz.lock.durationSec"))`
- **Grace Window**: `ConfigRegistry.getUint(keccak256("mezz.lock.graceSec"))`
- **Defaults**: 5 years (1,576,800,000 seconds), 30 days (2,592,000 seconds)

### Governance Controls

#### Access Control
- **GOV_ROLE**: Configuration and whitelist management
- **EMERGENCY_ROLE**: Force unlock capabilities
- **DEFAULT_ADMIN_ROLE**: Role management

#### Emergency Procedures
- **Force Unlock**: EMERGENCY_ROLE can unlock specific users
- **Pause/Unpause**: GOV_ROLE can pause all operations
- **Whitelist**: GOV_ROLE can whitelist addresses for operational exits

#### Configuration Management
- **Config Registry**: GOV_ROLE can update ConfigRegistry address
- **Whitelist Management**: Add/remove addresses from operational whitelist
- **Pause Controls**: Emergency pause/unpause functionality

### Integration Points

#### ERC-4626 Compliance
- **Standard Interface**: Full ERC-4626 compliance with lock overlay
- **Asset Wrapper**: No modification to underlying mezzanine asset
- **Share Accounting**: Standard ERC-4626 share calculation and distribution

#### ConfigRegistry Integration
- **Dynamic Configuration**: Lock duration and grace window from ConfigRegistry
- **Fallback Values**: Safe defaults when config keys unset
- **Runtime Updates**: Configuration changes apply to new deposits

### Operational Procedures

#### Normal Operations
1. **Deposit**: Users deposit mezzanine assets, lock extends
2. **Lock Monitoring**: Track unlock times and grace windows
3. **Withdrawal Management**: Handle unlock and grace window logic

#### Emergency Procedures
1. **Force Unlock**: Emergency role unlocks specific users
2. **Pause Operations**: Gov role pauses all vault operations
3. **Whitelist Management**: Add operational addresses to whitelist

#### Recovery Procedures
1. **Unpause**: Restore normal operations after emergency
2. **Config Updates**: Adjust lock duration or grace window
3. **Whitelist Cleanup**: Remove operational addresses from whitelist

### Risk Management

#### Lock Enforcement
- **Monotonic Extension**: Deposits only extend, never reduce lock time
- **Grace Window Logic**: Full withdrawal within grace window resets lock
- **Partial Withdrawal**: Maintains lock regardless of timing

#### Emergency Controls
- **Force Unlock**: Emergency role can unlock specific users
- **Pause Mechanism**: Complete operational halt capability
- **Whitelist Bypass**: Operational addresses can withdraw regardless of lock

#### Governance Oversight
- **Role-Based Access**: Clear separation of governance and emergency roles
- **Configurable Parameters**: Lock duration and grace window adjustable
- **Audit Trail**: Events for all lock and governance operations

### Technical Implementation

#### State Variables
- `minUnlockTs[address]`: Minimum unlock timestamp per account
- `whitelist[address]`: Operational whitelist bypass
- `configRegistry`: Configuration parameter source

#### Key Functions
- `deposit()` / `mint()`: Set/extend lock on deposit
- `withdraw()` / `redeem()`: Check lock before withdrawal
- `forceUnlock()`: Emergency unlock for specific users
- `setWhitelist()`: Manage operational whitelist
- `pause()` / `unpause()`: Emergency pause controls

#### Events
- `Locked(address indexed acct, uint256 newUnlockTs)`: Lock extension
- `ForceUnlocked(address indexed acct)`: Emergency unlock
- `WhitelistUpdated(address indexed acct, bool whitelisted)`: Whitelist changes
- `ConfigRegistryUpdated(address indexed newRegistry)`: Config updates

#### Error Codes
- `"MV/LOCKED"`: Withdrawal attempted before unlock
- `"MV/PAUSED"`: Operations attempted while paused
- `"MV/ZERO_ADDRESS"`: Invalid address provided
- `"MV/ONLY_GOV"`: Access control violation
- `"MV/ONLY_EMERGENCY"`: Emergency role required

### View Functions

#### Lock Status
- `minUnlockOf(address)`: Get unlock timestamp for account
- `isLocked(address)`: Check if account is currently locked
- `canWithdraw(address)`: Check if account can withdraw

#### Configuration
- `configRegistry()`: Get current ConfigRegistry address
- `whitelist(address)`: Check whitelist status for account

### Integration Notes

#### Asset Compatibility
- **ERC-20 Assets**: Compatible with any ERC-20 mezzanine asset
- **No Asset Modification**: Vault is pure wrapper, no asset changes
- **Share Accounting**: Standard ERC-4626 share calculation

#### ConfigRegistry Dependencies
- **Lock Duration**: `keccak256("mezz.lock.durationSec")`
- **Grace Window**: `keccak256("mezz.lock.graceSec")`
- **Fallback Logic**: Safe defaults when config unavailable

#### Governance Integration
- **Role Management**: Integrates with AccessControl system
- **Emergency Procedures**: Aligns with protocol emergency framework
- **Operational Controls**: Supports operational exit procedures

## Adaptive Issuance Controls

### Overview
The BRICS Protocol implements adaptive issuance controls to manage risk and maintain protocol stability through dynamic detachment adjustments, emergency halts, and automated trigger mechanisms.

### Core Components

#### IssuanceControllerV4
- **Purpose**: Manages issuance limits, detachment monotonicity, and emergency controls
- **Key State Variables**:
  - `superSeniorCap`: Current issuance cap in BRICS tokens (1e18)
  - `detachmentBps`: Current detachment level (e.g., 10_200 = 102.00%)
  - `issuanceLocked`: Emergency lock flag
  - `pendingRatifyUntil`: Ratification deadline timestamp

#### Emergency Level Integration
- **RED Halt**: When `emergency.level >= 2`, all issuance is halted
- **Config Source**: `ConfigRegistry.getUint(keccak256("emergency.level"))`
- **Default**: 0 (GREEN), 1 (AMBER), 2 (RED)

### Detachment Monotonicity

#### Raise Detachment
- **Immediate Effect**: Detachment can be raised instantly
- **Ratification Window**: 24-hour ratification period after raise
- **Minting During Window**: Allowed but requires ratification before expiry
- **Auto-Expiry**: If not ratified within 24h, further minting blocked

#### Lower Detachment
- **Cooldown Period**: 7-day minimum cooldown after last raise
- **Prerequisites**: No pending ratification window
- **Monotonicity**: Can only lower, never raise to same/higher value

#### Configuration
- **Cooldown**: `ConfigRegistry.getUint(keccak256("issuance.detach.cooldownSec"))`
- **Default**: 7 days (604,800 seconds)

### Trigger Matrix

#### Sovereign Usage Trigger
- **Threshold**: >20% (2000 bps)
- **Effect**: 10% cap reduction, +1% detachment
- **Rationale**: High sovereign concentration risk

#### Defaults Trigger
- **Threshold**: >5% (500 bps)
- **Effect**: 15% cap reduction, +2% detachment
- **Rationale**: Credit quality deterioration

#### Correlation Trigger
- **Threshold**: >65% (6500 bps)
- **Effect**: 20% cap reduction, +3% detachment
- **Rationale**: Systemic correlation risk

#### Multiple Triggers
- **Severity**: Most severe reduction applied
- **Cumulative**: Detachment increases stack
- **Ratification**: 24h window after trigger activation

### Emergency Controls

#### Issuance Lock
- **Authority**: ECC_ROLE only
- **Effect**: Immediate halt of all issuance
- **Recovery**: Manual unlock required
- **Use Case**: Emergency situations requiring immediate halt

#### RED Emergency Level
- **Automatic**: Triggered by ConfigRegistry emergency level
- **Effect**: All issuance halted regardless of other conditions
- **Recovery**: Requires emergency level reduction to <2

### Mint Gate Function

#### `checkMintAllowed(uint256 tokens)`
Enforces all issuance controls in sequence:

1. **Lock Check**: `issuanceLocked == false`
2. **Emergency Check**: `emergency.level < 2`
3. **Ratification Check**: `pendingRatifyUntil == 0 || block.timestamp <= pendingRatifyUntil`
4. **Cap Check**: `totalSupply + tokens <= superSeniorCap`

#### Error Codes
- `"IC/LOCKED"`: Issuance manually locked
- `"IC/RED_HALT"`: Emergency level RED
- `"IC/RATIFY_EXPIRED"`: Ratification window expired
- `"IC/CAP"`: Exceeds issuance cap

### Governance Functions

#### Cap Management
- **`setSuperSeniorCap(uint256 newCap)`**: GOV_ROLE only
- **Effect**: Immediate cap adjustment
- **Use Case**: Gradual capacity management

#### Detachment Management
- **`raiseDetachment(uint256 newBps)`**: GOV_ROLE only
- **`lowerDetachment(uint256 newBps)`**: GOV_ROLE only, requires cooldown
- **`ratifyDetachment()`**: GOV_ROLE only, within 24h window

#### Emergency Functions
- **`lockIssuance()`**: ECC_ROLE only
- **`unlockIssuance()`**: ECC_ROLE only
- **`adjustByTriggers(...)`**: ECC_ROLE only, automated risk response

### Integration Points

#### NASASAGateway Integration
- **Call Path**: `Gateway.mint() → IssuanceController.checkMintAllowed()`
- **No Duplication**: Gateway delegates all issuance logic to controller
- **Error Propagation**: Controller errors bubble up to user

#### ConfigRegistry Integration
- **Emergency Level**: `keccak256("emergency.level")`
- **Cooldown Period**: `keccak256("issuance.detach.cooldownSec")`
- **Fallback Values**: Defaults when config keys unset

### Operational Procedures

#### Normal Operations
1. Monitor detachment levels and cap utilization
2. Adjust caps based on market conditions
3. Raise detachment proactively for risk management

#### Emergency Procedures
1. **Immediate Lock**: Use `lockIssuance()` for urgent situations
2. **RED Level**: Set emergency level to 2 for systemic issues
3. **Trigger Response**: Monitor and respond to automated triggers

#### Recovery Procedures
1. **Ratification**: Complete detachment ratification within 24h
2. **Unlock**: Remove issuance lock when safe
3. **Emergency Reset**: Reduce emergency level when conditions improve

### Risk Management

#### Proactive Measures
- **Detachment Raises**: Gradual increases based on risk signals
- **Cap Adjustments**: Responsive to market conditions
- **Trigger Monitoring**: Automated risk detection and response

#### Reactive Measures
- **Emergency Locks**: Immediate response to critical situations
- **RED Level**: Systemic emergency response
- **Trigger Activation**: Automated risk mitigation

#### Recovery Measures
- **Ratification Windows**: Governance oversight of major changes
- **Cooldown Periods**: Prevent rapid oscillation
- **Gradual Unwinding**: Controlled return to normal operations

## §6. Per-Sovereign Soft-Cap Damping

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

## §8. NAV Redemption Lane

### Requirements
- NAV window open/close controls
- Events: NAVRequestCreated, NAVSettled
- BURNER_ROLE executor at settlement
- Views: nextCutoffTime, pendingBy(account), claimStatus(id)

### Implementation
- RedemptionClaim contract for NAV-based redemptions
- Time-based cutoff windows
- Settlement by authorized burners

## §9. Cross-Sovereign Configuration

### Requirements
- CRUD operations for sovereign configurations
- Emergency state management per sovereign
- Capacity allocation and utilization tracking

### Implementation
- ConfigRegistry manages sovereign parameters
- Emergency escalation triggers per sovereign
- Capacity damping during crisis

## §10. Mezzanine ERC-4626 Reinvest Lock (v4.0)

### 5-Year Lock Policy
- Timestamp-based policy enforcement
- Grace windows for exceptions
- Whitelist semantics for governance
- Governance controls for lock management

### Implementation
- MezzanineVault.sol enforces lock periods
- ConfigRegistry controls lock parameters
- Emergency override capabilities

## §11. Sovereign Claim SBT (v4.0)

### Overview
The Sovereign Claim SBT is a non-transferable ERC-721 token that notarizes each sovereign draw/claim and its complete lifecycle, anchored to off-chain ISDA/PFMA documentation and linked to on-chain redemption state.

### Core Components

#### SovereignClaimSBT Contract
- **Purpose**: Non-transferable ERC-721 SBT for sovereign claim lifecycle management
- **Base**: OpenZeppelin ERC721, AccessControl, Pausable
- **Soulbound**: All transfers/approvals reverted except mint/burn by authorized roles

### Lifecycle Management

#### Claim Status Enum
```solidity
enum ClaimStatus { 
    Filed, 
    Acknowledged, 
    PaidToSPV, 
    ReimbursedBySovereign, 
    Closed 
}
```

#### Lifecycle Flow
1. **Filed**: Initial claim filed with ISDA annex hash and documentation
2. **Acknowledged**: Sovereign acknowledges the claim
3. **PaidToSPV**: Payment made to Special Purpose Vehicle
4. **ReimbursedBySovereign**: Sovereign reimburses the SPV
5. **Closed**: Claim fully settled and closed

#### Monotonic Progression
- Status can only move forward, never backward
- Each transition requires specific role permissions
- Timestamps recorded for each status change

### Role-Based Access Control

#### Roles
- **GOV_ROLE**: Protocol governance and claim closure
- **SOV_ROLE**: Sovereign operations authority (treasury/guarantor ops)
- **ECC_ROLE**: Emergency credit committee

#### Function Permissions
- **fileClaim**: GOV_ROLE or ECC_ROLE
- **acknowledge**: SOV_ROLE only
- **markPaidToSPV**: SOV_ROLE only
- **markReimbursed**: SOV_ROLE or GOV_ROLE
- **close**: GOV_ROLE only
- **setHashes**: GOV_ROLE only (during Filed/Acknowledged)
- **setEvidenceURI**: GOV_ROLE only

### Documentation Anchoring

#### ISDA/PFMA Integration
- **isdaAnnexHash**: Hash of signed ISDA annex/amendment
- **docsBundleHash**: Hash of evidence pack (PDF bundle, DocuSign, etc.)
- **evidenceURI**: Optional IPFS or HTTPS URI for additional evidence

#### Immutability Windows
- **Filed/Acknowledged**: Hashes can be updated
- **PaidToSPV+**: Hashes become immutable
- **EvidenceURI**: Can be updated at any time

### Integration Points

#### RedemptionQueue Linkage
- **redemptionId**: Links to RedemptionQueue claimId
- **usdcNotional**: Requested/paid amount in USDC (6 decimals)
- **No Breaking Changes**: RedemptionQueue unchanged

#### NASASAGateway Integration
- Optional emit on month-end strike if sovereign draw initiated
- No hard dependencies or gating logic
- Maintains protocol stability

### Soulbound Enforcement

#### Transfer Prevention
- All ERC-721 transfer functions overridden
- `approve()`, `setApprovalForAll()`, `transferFrom()`, `safeTransferFrom()` all revert
- Only mint (by authorized roles) and burn (when closed) allowed

#### Burn Rules
- **Closed Status Only**: Tokens can only be burned when status = Closed
- **Authorized Burners**: GOV_ROLE or token owner
- **Complete Cleanup**: Claim data deleted on burn

### Emergency Controls

#### Pause Functionality
- **GOV_ROLE**: Can pause/unpause all operations
- **State Changes**: All lifecycle functions respect pause state
- **Emergency Recovery**: Unpause restores full functionality

#### Error Handling
- **SBT_ONLY_FORWARD**: Prevents backward status progression
- **SBT_ONLY_ROLE**: Enforces role-based access
- **SBT_NO_TRANSFER**: Enforces soulbound semantics
- **SBT_INVALID_STATUS**: Prevents invalid status transitions

### Events and Audit Trail

#### Lifecycle Events
- `Filed(tokenId, redemptionId, usdcNotional)`
- `Acknowledged(tokenId)`
- `PaidToSPV(tokenId, usdcPaid)`
- `Reimbursed(tokenId, usdcReimbursed)`
- `Closed(tokenId)`

#### Metadata Events
- `URISet(tokenId, uri)`
- `HashesSet(tokenId, isdaAnnexHash, docsBundleHash)`

### Operational Procedures

#### Claim Filing Process
1. **Off-Chain**: Legal team prepares ISDA annex and documentation
2. **On-Chain**: GOV_ROLE or ECC_ROLE calls `fileClaim()`
3. **Verification**: Hashes verified against off-chain documents
4. **Tracking**: SBT provides immutable audit trail

#### Settlement Process
1. **Acknowledgment**: SOV_ROLE acknowledges claim
2. **Payment**: SOV_ROLE marks payment to SPV
3. **Reimbursement**: SOV_ROLE or GOV_ROLE marks reimbursement
4. **Closure**: GOV_ROLE closes claim
5. **Cleanup**: Optional burn of SBT

### Compliance and Legal Framework

#### ISDA/PFMA Compliance
- **Document Anchoring**: All legal documents hashed on-chain
- **Audit Trail**: Complete lifecycle tracking
- **Immutable Records**: Critical documents cannot be modified after payment

#### Regulatory Reporting
- **Status Tracking**: Real-time claim status visibility
- **Amount Tracking**: USDC notional amounts recorded
- **Timeline Tracking**: All milestone timestamps preserved

### Technical Implementation

#### Gas Optimization
- **Efficient Storage**: Packed structs for claim data
- **Minimal Overhead**: Only essential data stored on-chain
- **Batch Operations**: Support for multiple claim processing

#### Security Features
- **Role-Based Access**: Granular permission control
- **Status Validation**: Prevents invalid state transitions
- **Soulbound Design**: Prevents token speculation or transfer

## §12. Risk FastAPI (v4.0)

### Aggregate-Only Feeds
- No PII exposure
- Model hash provenance
- Versioning support

### Endpoints
- `/nav/latest` → {nav, ts, model_hash}
- `/emergency/level` → {level, triggers, time_in_state}
- `/emergency/buffers` → {pre_tranche, irb, targets, health}
- `/risk/aggregate` → {tail_corr, sov_util, buffer_health}

### Security
- Member-gated access
- Rate limiting
- Audit logging

## §13. Emergency State Management

### State Transitions
- NORMAL → YELLOW → ORANGE → RED
- Automatic escalation based on triggers
- Manual override capabilities

### Emergency Parameters
- IRB targets by state
- AMM slippage bounds
- Issuance rate limits
- Detachment expansion rules

### Recovery Procedures
- State restoration protocols
- Oracle recovery
- Capacity restoration

## §14. Security & Access Control

### Role-Based Access
- NASASA_ROLE: Operational control
- SPV_ROLE: Special purpose vehicle
- OPERATOR_ROLE: Day-to-day operations
- MINTER_ROLE: Token minting
- BURNER_ROLE: Token burning

### Emergency Controls
- Pausable functionality
- Kill switch mechanisms
- Emergency override capabilities

### Audit Requirements
- Complete on-chain audit trails
- Legal milestone tracking
- Regulatory compliance

## §15. Integration Points

### Off-Chain Systems
- Risk ingestion APIs
- Emergency assessment engines
- Legal framework integration
- Regulatory reporting

### On-Chain Coordination
- Multi-contract interactions
- Event-driven architecture
- State consistency enforcement

### External Dependencies
- Oracle price feeds
- Emergency signers
- Legal framework anchors
