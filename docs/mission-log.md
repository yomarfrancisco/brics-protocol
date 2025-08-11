# BRICS Protocol — Running Mission Log

**Last Updated**: 2025-08-11

---

## Phase 0 — Stabilization (P0)

**Goal**: Make CI/CD & testing bulletproof before starting feature work.

**Status**: ✅ **Completed** (PRs #8–#13)

- **Coverage Floor**: Raised from 31% → 55% → 63% (fast track baseline)
- **Invariants Smoke Test**: Runs in CI with minimal deploy; continue-on-error disabled
- **Security**: Slither SARIF with allowlist guard
- **Docs**: README badges for tests, coverage, security, gas
- **Process Guards**: PR fails if allowlist grows without justification
- **All CI Jobs Green**: Tests, coverage, security, gas

---

## Phase 1 — Feature Expansion (P1)

**Goal**: Implement functional protocol features, keeping CI stable and contracts safe.

### P1-1 Adaptive Tranching v0.1 (current)
- Add AdaptiveTrancheManager scaffold
- Mirror current TrancheManagerV2 API
- Add stub logic for:
  - Tier configuration (super-senior, mezzanine, first-loss)
  - Risk capacity checks
  - Issuance throttling based on tranche limits
- Unit tests for allocation math & edge cases
- No economic or oracle logic yet (placeholder returns)
- **PR name**: feat: adaptive tranche manager scaffold (no economic logic)

### P1-2 Pricing Service (CDS + RISC) — Next Context Switch
- Off-chain service using XGBoost for CDS spreads & RISC scores
- Ingest bank portfolio + sovereign hedge data
- Publish to on-chain oracle feed
- Integration tests with AdaptiveTrancheManager

### P1-3 KYC/AML Module
- NASASA retail onboarding
- Institutional whitelist management
- Integration with issuance/redemption flow

---

## Phase 2 — Full Economic Integration (P2)

**Goal**: Connect adaptive tranching to live CDS pricing & sovereign hedge logic.

- Implement tranche APY & risk calculations on-chain from oracle data
- Enable dynamic issuance limits based on sovereign capacity
- Sovereign guarantee hedging logic
- Redemption queue prioritization

---

## Phase 3 — Off-Chain Ops & Governance (P3)

**Goal**: Institutional-grade operational resilience.

- Governance module (DAO-style) for tranche parameter tuning
- Failover modes & circuit breakers
- On-chain + off-chain dashboards

---

## Next High Level Actions

**Current Step**: Build P1-1 AdaptiveTrancheManager scaffold

**After P1-1**: Context switch to P1-2 Pricing Service (off-chain AI/CDS pricing)

**Keep In Mind**: Always ship PRs small & reviewable; no economic logic changes until tests cover scaffold behavior

---

## Current Status (2025-08-11)

### P1-1 Adaptive Tranching v0.1 Progress
- ✅ **PR #14**: ADR + Types (merged)
- ✅ **PR #15**: Interfaces + Events (merged)
- ✅ **PR #16**: Oracle Adapter Stub + Governance Hooks + Tests (merged)

### Current Status
- **Coverage**: 60% statements (close to 63% target)
- **Tests**: 186 passing, comprehensive coverage for new functions
- **Security**: All checks passing, 0 high findings
- **Next**: Ready for P1-2 Pricing Service implementation

### Next Actions (P1-2: Pricing Service)
1. **Off-chain XGBoost Service**: CDS spreads & RISC scores
2. **Oracle Integration**: Publish to on-chain feed
3. **Deterministic Fixtures**: For testing and CI
4. **Integration Tests**: With AdaptiveTrancheManager

### Acceptance Criteria
- Off-chain service with XGBoost models
- On-chain oracle adapter integration
- Deterministic test fixtures
- CI hooks for pricing service
- Integration tests with existing adaptive tranching
