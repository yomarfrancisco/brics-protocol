# Observability Guide

This document describes the observability tools and artifacts available in the BRICS protocol.

## Overview

The BRICS protocol provides comprehensive observability through:

- **Gas Trend Analysis**: Historical gas usage tracking and visualization
- **Audit Bundles**: Complete build and test attestations
- **CI Artifacts**: Automated generation and storage of observability data
- **Fixture Management**: Deterministic test data with freshness controls

## Gas Trend Analysis

### Nightly Gas Collection

The protocol automatically collects gas usage data through a nightly CI job:

```bash
# Run gas trend collection locally
yarn gas:trend

# Generate gas trend chart
yarn gas:chart
```

### Artifacts

- **CSV Data**: `dist/gas/gas-trend.csv` - Historical gas measurements
- **Chart**: `dist/gas/gas-trend.svg` - Time-series visualization
- **CI Job**: `gas-nightly` - Runs on schedule and workflow_dispatch

### CSV Format

```csv
date,sha,suite,function,gas
2025-08-13,5578cab,ConfigRegistry,setTradeFeeBps,29189
2025-08-13,5578cab,InstantLane,instantRedeem,45678
```

### Chart Features

- Time-series visualization of gas usage
- Color-coded by function/contract
- Legend showing all tracked functions
- Automatic scaling and formatting
- Hoverable data points with detailed information
- 7-point moving average lines (dashed)
- Axis labels and tick marks

### How to Read Gas Trends

#### Chart Elements
- **Solid Lines**: Actual gas measurements over time
- **Dashed Lines**: 7-point moving average (trend indicator)
- **Data Points**: Hover for function name, date, gas usage, and commit SHA
- **Y-Axis**: Gas usage in thousands (e.g., 50 = 50,000 gas)
- **X-Axis**: Date of measurement

#### Trend Analysis
- **Upward Trend**: Gas usage increasing (potential optimization needed)
- **Downward Trend**: Gas usage decreasing (optimizations working)
- **Flat Trend**: Stable gas usage (good)
- **Spikes**: Sudden increases (investigate specific commits)

#### Key Metrics
- **Average Gas**: Overall gas usage across all functions
- **Top Functions**: Highest gas-consuming functions
- **Trend Direction**: Moving average slope
- **Volatility**: Consistency of gas usage over time

## Audit Bundles

### Bundle Contents

Each audit bundle contains:

- **Build Manifest**: Git info, environment, contract hashes
- **Fixtures Index**: Test data with integrity checks
- **Test Attestation**: Pass/fail counts and durations
- **Events Documentation**: Auto-generated contract events
- **Gas Report**: Current gas usage analysis
- **Release Notes**: Detailed change documentation

### Bundle Generation

```bash
# Generate complete audit bundle
yarn audit:bundle

# Individual components
yarn audit:manifest    # Build manifest
yarn audit:fixtures    # Fixtures index
yarn audit:tests       # Test attestation
yarn audit:events      # Events documentation
```

### Bundle Comparison

Compare audit bundles to detect changes:

```bash
# Compare two bundles
yarn audit:diff --base manifest-a.json --head manifest-b.json
```

The diff report shows:
- Contract bytecode/ABI changes
- Fixture hash changes
- Test result changes
- Summary of all differences

## CI Artifacts

### Available Artifacts

All CI jobs upload observability artifacts:

- **Unit Tests**: Gas report, events docs, audit bundle
- **Nightly Gas**: CSV data, trend chart
- **Audit Bundle**: Complete bundle with integrity checks
- **Release Dry-Run**: Release notes and changelog

### Artifact Retention

- **Retention**: 14 days
- **Format**: ZIP archives with metadata
- **Access**: GitHub Actions artifacts tab

### Artifact Naming

- `gas-report_<sha>` - Gas usage analysis
- `events-docs_<sha>` - Contract events documentation
- `audit-bundle_<sha>` - Complete audit bundle
- `gas-nightly_<run_id>` - Nightly gas trend data

## Fixture Management

### Fixture Freshness

Fixtures are automatically checked for freshness:

```bash
# Check fixture freshness
yarn fixtures:check

# Refresh fixtures
yarn fixtures:freeze
yarn fixtures:hashcheck
```

### Freshness Policy

- **Threshold**: 30 days maximum age
- **CI Check**: Automatic staleness detection
- **Auto-Rotation**: Weekly automated PRs
- **Manual Refresh**: `yarn fixtures:freeze`

### Fixture Types

- **Frozen Fixtures**: Deterministic test data with integrity checks
- **Latest Fixtures**: Current test data (regenerated each run)
- **Hash Files**: SHA256 integrity verification

## Local Development

### Running Observability Tools

```bash
# Gas analysis
GAS_REPORT=true yarn hardhat test test/fast/economics/config.spec.ts
yarn gas:trend
yarn gas:chart

# Audit tools
yarn audit:manifest
yarn audit:fixtures
yarn audit:tests
yarn audit:events
yarn audit:bundle

# Fixture management
yarn fixtures:check
yarn fixtures:freeze
yarn fixtures:hashcheck
```

### Environment Variables

- `FIXTURE_SEED` - Deterministic fixture generation
- `PROP_TRIALS` - Property test trial count (default: 32)
- `GAS_REPORT` - Enable gas reporting (set to "true")

### Output Locations

- `dist/gas/` - Gas trend data and charts
- `dist/audit/` - Audit artifacts and bundles
- `pricing-fixtures/` - Test fixtures and hashes
- `gas-report.txt` - Current gas usage report

## Troubleshooting

### Common Issues

**Fixture Stale Error**
```bash
# Solution: Refresh fixtures
yarn fixtures:freeze && yarn fixtures:hashcheck
```

**Gas Report Missing**
```bash
# Solution: Enable gas reporting
GAS_REPORT=true yarn hardhat test
```

**Audit Bundle Generation Fails**
```bash
# Solution: Ensure contracts are compiled
yarn hardhat compile
yarn audit:bundle
```

### Debugging

- Check CI logs for detailed error messages
- Verify artifact uploads in GitHub Actions
- Use `yarn fixtures:check` to diagnose fixture issues
- Review gas trend CSV for data quality

## Integration

### CI/CD Integration

All observability tools are integrated into CI:

- **Pre-commit**: Fixture freshness checks
- **Unit Tests**: Gas reporting and audit bundle generation
- **Nightly Jobs**: Gas trend collection and analysis
- **Release Process**: Complete audit trail generation

### External Tools

- **GitHub Actions**: Artifact storage and workflow automation
- **GitHub Releases**: Artifact attachment and documentation
- **GitHub PRs**: Audit bundle diff comments (planned)

## Quick Commands

```bash
# Gas trend locally
GAS_REPORT=true yarn hardhat test -g "bounds|economics"
yarn gas:trend
yarn gas:chart

# Audit diff locally (example)
yarn audit:bundle
yarn audit:diff --base manifest-a.json --head manifest-b.json

# Fixture management
yarn fixtures:check
yarn fixtures:freeze
```

## Best Practices

### Gas Analysis

- Run gas tests on representative workloads
- Track trends over time, not absolute values
- Use deterministic test suites for consistent measurements
- Monitor for unexpected gas usage spikes

### Audit Bundles

- Generate bundles for all releases
- Store bundles with release artifacts
- Compare bundles between releases
- Use bundles for security audits

### Fixture Management

- Keep fixtures fresh (refresh before 30-day limit)
- Use deterministic seeds for reproducible data
- Verify fixture integrity with hash checks
- Document fixture changes in commit messages

## Future Enhancements

### Planned Features

- **Audit Bundle Diff PR Comments**: Automatic diff reports on PRs
- **Enhanced Gas Analysis**: More detailed gas breakdowns
- **Performance Monitoring**: Runtime performance metrics
- **Security Scanning**: Automated security analysis

### Contributing

To add new observability features:

1. Follow existing patterns and naming conventions
2. Ensure deterministic outputs
3. Add appropriate CI integration
4. Update this documentation
5. Include example usage and troubleshooting

---

For more information, see:
- [Release Process](RELEASE.md) - Release observability
- [Audit Trails](AUDIT_TRAILS.md) - Audit bundle details
- [Contributing](CONTRIBUTING.md) - Development guidelines
