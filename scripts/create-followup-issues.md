# Follow-up Issues for v0.2.1

## Issue 1: Nightly Gas Trend + Chart

**Title**: Nightly gas trend job (append to CSV and chart)

**Description**:
Create a nightly CI job that:
- Runs gas tests and appends results to a CSV file
- Generates a trend chart showing gas usage over time
- Non-blocking job that runs on schedule
- Stores historical gas data for analysis

**Acceptance Criteria**:
- [ ] Nightly gas collection job
- [ ] CSV storage with timestamps
- [ ] Trend visualization (chart)
- [ ] Non-blocking CI integration

---

## Issue 2: Audit Bundle Diff Action

**Title**: Audit bundle diff action (compare last two bundles)

**Description**:
Create a GitHub Action that:
- Compares the last two audit bundles
- Comments on PRs with bundle differences
- Highlights changes in contracts, events, gas usage
- Provides diff summary for review

**Acceptance Criteria**:
- [ ] Bundle comparison logic
- [ ] PR comment integration
- [ ] Diff summary generation
- [ ] CI workflow integration

---

## Issue 3: Property Tests - Widen Envelopes

**Title**: Extend property tests coverage envelopes

**Description**:
Expand property test coverage to include:
- Wider parameter ranges for stress testing
- More edge cases and boundary conditions
- Additional contract interactions
- Performance and gas optimization scenarios

**Acceptance Criteria**:
- [ ] Extended parameter ranges
- [ ] Additional edge case coverage
- [ ] Performance testing scenarios
- [ ] Comprehensive property test suite
