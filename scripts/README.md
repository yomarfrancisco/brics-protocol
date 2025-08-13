# Scripts Usage Guide

Quick reference for all scripts in the BRICS protocol.

## 🧪 Testing Scripts

### Property Tests
```bash
# Run property tests with default trials (32)
yarn test:prop

# Run with custom trial count
PROP_TRIALS=64 yarn test:prop
```

### Smoke Tests
```bash
# Run dev bootstrap smoke test (≤60s)
yarn smoke:dev

# Run full smoke suite
yarn smoke
```

## ⛽ Gas Analysis

### Gas Reporting
```bash
# Generate gas report for specific tests
GAS_REPORT=true yarn hardhat test test/fast/amm/instant-bounds-levels.spec.ts

# Check gas budget
yarn gas:budget
```

### Gas Trends
```bash
# Collect gas trend data
yarn gas:trend

# Generate gas trend chart
yarn gas:chart

# Generate gas summary
yarn gas:summary

# All gas analysis
yarn gas:trend && yarn gas:chart && yarn gas:summary
```

## 📦 Audit & Bundle

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
```bash
# Compare two manifests
yarn audit:diff --base manifest-a.json --head manifest-b.json
```

## 🔧 Fixture Management

### Fixture Operations
```bash
# Check fixture freshness
yarn fixtures:check

# Generate new fixtures
yarn fixtures:gen

# Freeze fixtures for CI
yarn fixtures:freeze

# Verify fixture hashes
yarn fixtures:hashcheck

# Show fixture summary
yarn fixtures:summary
```

## 🚀 Release Management

### Release Automation
```bash
# Determine next version
yarn release:next

# Generate release notes
yarn release:notes

# Run release dry-run
yarn release:dry
```

## 🏗️ Development

### Bootstrap
```bash
# Bootstrap dev environment
yarn hardhat dev:bootstrap

# Or use shell script
./scripts/dev/bootstrap.sh
```

### Deployment
```bash
# Deploy to local network
yarn deploy:dev

# Deploy to testnet
yarn deploy:sepolia
```

## 📊 Observability

### Local Verification
```bash
# Run all observability tools
yarn gas:trend && yarn gas:chart && yarn gas:summary
yarn audit:bundle
yarn fixtures:check

# Quick health check
yarn test:unit && yarn fixtures:check
```

### CI Artifacts
- **Gas Report**: `gas-report.txt`
- **Gas Trends**: `dist/gas/gas-trend.csv`, `dist/gas/gas-trend.svg`
- **Gas Summary**: `dist/gas/gas-summary.md`
- **Audit Bundle**: `dist/audit/audit-bundle-*.zip`
- **Events Doc**: `docs/CONTRACT_EVENTS.md`

## 🔍 Troubleshooting

### Common Issues
```bash
# Fix fixture staleness
yarn fixtures:freeze && yarn fixtures:hashcheck

# Regenerate gas data
yarn gas:trend && yarn gas:chart

# Rebuild audit bundle
yarn audit:bundle

# Check all systems
yarn fixtures:check && yarn gas:summary && yarn audit:manifest
```

### Environment Variables
- `FIXTURE_SEED` - Deterministic fixture generation
- `PROP_TRIALS` - Property test trial count (default: 32)
- `GAS_REPORT` - Enable gas reporting (set to "true")
- `CI_SIGNER_PRIVKEY` - CI signer for deterministic tests

## 📝 Best Practices

1. **Always check fixtures** before committing: `yarn fixtures:check`
2. **Run gas analysis** for contract changes: `GAS_REPORT=true yarn test`
3. **Generate audit bundle** for releases: `yarn audit:bundle`
4. **Use deterministic seeds** for reproducible outputs
5. **Check CI artifacts** after pushing

---

For detailed documentation, see:
- [Observability Guide](../docs/OBSERVABILITY.md)
- [Release Process](../docs/RELEASE.md)
- [Maintenance Guide](../docs/MAINTENANCE.md)
