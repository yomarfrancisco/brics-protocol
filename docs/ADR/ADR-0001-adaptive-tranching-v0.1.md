# ADR-0001: Adaptive Tranching v0.1 (Scaffold)

## Status
Proposed

## Context
The BRICS Protocol needs to implement adaptive tranching capabilities to respond to real-time risk signals without changing core economics. This ADR defines the v0.1 scaffold that will enable future dynamic issuance capacity and detachment adjustments.

## Decision
Implement Adaptive Tranching v0.1 as a feature-flagged scaffold with clean interfaces, events, and governance hooks.

## Risk Signals

### Signal Structure
```solidity
struct RiskSignal {
    uint64 sovereignUsageBps;    // Sovereign guarantee utilization (0-10000 bps)
    uint64 portfolioDefaultsBps; // Portfolio default rate (0-10000 bps)  
    uint32 corrPpm;              // Correlation coefficient (0-1000000 ppm)
    uint48 asOf;                 // Timestamp of signal
}
```

### Signal Thresholds
- **Sovereign Usage**: `sovereignUsageBps > 2000` (20% utilization)
- **Portfolio Defaults**: `defaultsBps > defaultThresholdBps` (configurable)
- **Correlation**: `corrPpm > 650000` (65% correlation)

## Operating Modes

### Mode Enum
```solidity
enum TranchingMode {
    DISABLED,   // 0: No adaptive behavior
    DRY_RUN,    // 1: Log signals, no enforcement
    ENFORCED    // 2: Full adaptive behavior (future)
}
```

### Default State
- **Mode**: `DISABLED` (0)
- **No economic impact**: Issuance math, detachment points, NAV unchanged
- **Future phases**: Only issuance throttling, no payout changes

## Implementation Phases

### Phase 1: Scaffold (v0.1) - This ADR
- ✅ Interfaces and events
- ✅ Oracle adapter stub
- ✅ Governance hooks
- ✅ Feature flag: `tranchingMode`
- ✅ No economic logic changes

### Phase 2: Enforcement (v0.2) - Future
- Dynamic issuance capacity adjustments
- Detachment point modifications
- Real-time risk response

### Phase 3: Integration (v0.3) - Future  
- External oracle integration
- Automated signal processing
- Full adaptive behavior

## Technical Constraints

### Storage Safety
- Maintain upgrade-safety with storage layout comments
- Use storage gaps where applicable
- No changes to existing contract storage

### Security
- Role-gated signal submission
- Non-reentrant functions where appropriate
- No external calls in loops

### Testing
- Unit tests for all new functionality
- Coverage must remain ≥63%
- Slither must show 0 high findings

## Acceptance Criteria
- [ ] ADR committed and reviewed
- [ ] Interfaces compile without errors
- [ ] Events emit correctly
- [ ] Governance hooks work as expected
- [ ] CI passes (tests, coverage, security)
- [ ] No economic logic changes
- [ ] Feature flag defaults to DISABLED

## Consequences

### Positive
- Clean foundation for adaptive behavior
- No disruption to existing functionality
- Governance-controlled rollout
- Future-proof architecture

### Risks
- Additional complexity in codebase
- Potential for future bugs in enforcement logic
- Oracle dependency risk (mitigated by DISABLED default)

### Mitigation
- Feature flag prevents accidental activation
- Comprehensive testing before enforcement
- Gradual rollout through DRY_RUN mode
