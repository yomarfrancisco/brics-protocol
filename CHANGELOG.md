# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Economics parameters system with bounded setters
- Gas budget monitoring and reporting
- Comprehensive governance and permissions framework
- Risk API safety endpoints
- BRICS token deployment and integration
- Dev bootstrap system for local development
- Replay pipeline hardening and deterministic fixtures

### Changed
- Enhanced ConfigRegistry with economics parameters
- Improved InstantLane with pause functionality and access control
- Updated Treasury with zero-address guards
- Enhanced test suite with comprehensive coverage

### Fixed
- CI artifact naming conflicts
- Test stability with EVM snapshots
- USDC funding helper improvements
- Governance event emission consistency

## [0.2.0] - 2025-08-13

### Added
- complete replay hardening with property tests and invariants
- add replay artifacts upload and local repro script
- add CI environment validation script
- add deterministic fixture generation for CI
- **risk-api**: complete Objective 6 - aggregate-only feeds with signed FastAPI endpoints
- P1-4 CDS Swap Module scaffold (#26)
- **compliance**: KYC/AML service skeleton with deterministic mock responses (#25)
- **pricing**: deterministic baseline model math + tests (no contract changes) (#23)
- **pricing**: P1-2 service skeleton + CI smoke test (Issue #19, non-blocking) (#22)

### Changed
- consolidate replay tests - keep only test/replay/cds-swap.e2e-replay.spec.ts
- v0.1.0 (deterministic, non-bank) (#32)
- raise fast coverage ≥63% (no contract changes) (#17)
- add AdaptiveTranchingOracleAdapter stub (#16)
- add Adaptive Tranching v0.1 interfaces and events (#15)

### Fixed
- resolve USDC funding issues in InstantLane tests
- resolve CI artifact 409 conflicts with unique names and guardrails
- bullet-proof test/replay/cds-swap.e2e-replay.spec.ts to prevent null errors
- **replay**: bullet-proof test/replay/cds-swap.e2e-replay.spec.ts to prevent null errors
- **replay**: bullet-proof value normalization with consistent usage in digest and contract
- **replay**: use normalized values consistently in digest and settleSwap call
- **ci**: auto-scan fixture hashcheck + NASASAGateway constructor for tests
- correct hardhat test patterns and replay test structure
- **test**: move replay test to tests/ directory to exclude from main test suite
- **test**: move replay test to separate directory to avoid main test suite conflicts
- **test**: use dynamic timestamps and advance time for settlement in E2E demo tests
- **ci**: generate fixture in smoke job to match replay job
- **test**: update asOf assertion to check type instead of fixed value
- **test**: add missing fields to quote in E2E demo test
- **ci**: skip coverage/gas on push, fix timestamp issues in tests
- **ci**: resolve CI issues - mocha reporter, Makefile pattern, coverage/gas non-blocking


## [0.1.0] - 2024-01-01

### Added
- Initial BRICS protocol implementation
- Core contracts: InstantLane, Treasury, ConfigRegistry
- Basic test suite and CI pipeline
- Documentation and deployment scripts
## v0.2.1 — R&O + DX
- P2-3: Risk bands, telemetry, rolling avg, base APY override
- CI: ABI/storage freeze in audit-bundle job
- Fixtures/Replay refreshed; E2E settlement stable
## v0.2.1 — R&O + DX
- P2-3: Risk bands, telemetry, rolling avg, base APY override
- CI: ABI/storage freeze in audit-bundle job
- Fixtures/Replay refreshed; E2E settlement stable
## v0.2.2+1 — Hotfix CEI validation
- Test-only: MockNAVOracleV3 + CEI rollback repair
## v0.2.3 — Redemption Queue View (read-only)
- P2-4: Priority scoring view + tests
- Docs append-only; artifacts regenerated

## v0.2.3+1 — Test-only: NASASAGateway ctor wiring
- Fix: update NASASAGateway integration tests to new RedemptionQueue ctor (3 args)
- Mocks: extend MockConfigRegistry for queue compat

## v0.2.3+2 — CI stability (InstantLane ctor)
- Tests: align InstantLane deployments with current ABI (add gov)
- CI: Release Validation green on main before tagging

## v0.2.3+3 — CI green (token MINTER_ROLE spec)
- Tests: stabilize mint role requirement (dynamic role id; correct revert)
## v0.2.3+4 — Swap E2E fix
- Align settle call with ABI; tests green
## v0.2.3+5 — Parity stabilization
- Fixture isolation and deterministic time for CDS suite
## v0.2.3+6 — RBAC stabilization
- Fixture isolation and deterministic time for RBAC suite
## v0.2.3+7 — Replay canary hardened
- Defensive fixture loading with graceful skips
## v0.2.3+8 — Settlement timestamp stabilization
- Fixture isolation + deterministic time
## v0.2.3+9 — verify-quote stabilized
- Fixture isolation + EIP-191 parity
## v0.2.3+10 — RV stabilization
- Fixture isolation + deterministic time + EIP-191 parity + ABI tuple alignment
## v0.2.3+11 — RV: tranche rolling avg stabilized
- Fixture time + scaled samples + min-sample policy
## v0.2.3+12 — RV: telemetry flags stabilized
- Flag bit sync + conditional assertions; fixture time
