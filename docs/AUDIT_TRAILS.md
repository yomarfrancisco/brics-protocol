# Audit Trails

This document describes the audit trail system that provides deterministic, signed "audit bundles" proving what was built, tested, and shipped.

## Overview

The audit trail system generates comprehensive bundles containing:

- **Build manifest**: Git commit, environment info, contract hashes
- **Fixtures index**: Deterministic test data with integrity checks
- **Test attestations**: Pass/fail counts and durations
- **Gas reports**: Performance metrics and budgets
- **Event documentation**: Auto-generated contract event tables
- **Release artifacts**: Changelog and release notes

## Bundle Contents

### Core Artifacts

| File | Description |
|------|-------------|
| `manifest.json` | Build environment, git info, contract hashes |
| `fixtures.json` | Test fixture inventory with SHA256 hashes |
| `fixtures.sha256` | Tree hash of all fixtures |
| `tests.json` | Test run attestation (pass/fail counts) |
| `events.json` | Contract events inventory |
| `gas-summary.csv` | Key function gas metrics |

### Supporting Files

| File | Description |
|------|-------------|
| `gas-report.txt` | Detailed gas analysis |
| `CHANGELOG.md` | Version history |
| `dist/release-notes.md` | Release documentation |
| `.devstack/addresses.json` | Local development addresses |
| `coverage/` | Test coverage reports |

### Bundle Metadata

| File | Description |
|------|-------------|
| `bundle-info.json` | Bundle metadata and contents list |
| `audit-bundle.sha256` | Bundle integrity hash |

## Verification

### Local Verification

```bash
# Generate audit bundle locally
yarn audit:manifest && yarn audit:fixtures && yarn audit:tests && yarn audit:events && yarn audit:bundle

# Verify bundle contents
unzip -l dist/audit/audit-bundle-*.zip

# Verify bundle hash
shasum -a 256 dist/audit/audit-bundle-*.zip
cat dist/audit/audit-bundle.sha256
```

### Hash Verification

Each artifact includes integrity checks:

```bash
# Verify fixtures
yarn fixtures:hashcheck

# Verify bundle hash
diff <(shasum -a 256 dist/audit/audit-bundle-*.zip | cut -d' ' -f1) dist/audit/audit-bundle.sha256
```

### Manifest Verification

The build manifest contains:

- **Git info**: Commit SHA, branch, last tag, dirty state
- **Environment**: Node, Yarn, Hardhat, Solidity versions
- **Contracts**: Bytecode and ABI hashes, compiler settings
- **Files**: SHA256 hashes of key files

```bash
# View manifest
cat dist/audit/manifest.json | jq '.git'
cat dist/audit/manifest.json | jq '.contracts[] | {name, bytecodeHash}'
```

## Comparing Bundles

### Diff Two Bundles

```bash
# Extract bundles
unzip audit-bundle-abc123.zip -d bundle1/
unzip audit-bundle-def456.zip -d bundle2/

# Compare manifests
diff bundle1/bundle-info.json bundle2/bundle-info.json

# Compare contract hashes
diff <(jq -r '.contracts[].bytecodeHash' bundle1/manifest.json | sort) \
     <(jq -r '.contracts[].bytecodeHash' bundle2/manifest.json | sort)
```

### Key Differences to Check

1. **Contract Changes**: Bytecode hashes should differ if contracts changed
2. **Environment**: Node/Hardhat versions should be consistent
3. **Fixtures**: Test data should be deterministic
4. **Tests**: Pass/fail counts should be stable
5. **Gas**: Performance should be within expected ranges

## CI Integration

### Automated Generation

The CI automatically generates audit bundles on:

- **Scheduled runs**: Daily/weekly builds
- **Manual triggers**: `workflow_dispatch` events
- **Release candidates**: Before tagging

### Artifact Access

Audit bundles are available as GitHub Actions artifacts:

1. Go to [GitHub Actions](https://github.com/bricsprotocol/brics-protocol/actions)
2. Find the "Audit Bundle" job
3. Download the `audit-bundle-*.zip` artifact
4. Extract and verify contents

### Bundle Retention

- **Retention period**: 14 days
- **Storage**: GitHub Actions artifacts
- **Access**: Public (no secrets included)

## Event Documentation

### Auto-Generated Tables

The system generates `docs/CONTRACT_EVENTS.md` with:

| Contract | Event | Inputs | Indexed | Notes |
|----------|-------|--------|---------|-------|
| InstantLane | InstantRedeemed | user, amount, fee | 1 | Redemption event |
| ConfigRegistry | ParamSet | key, oldValue, newValue | 0 | Parameter update |

### Event Analysis

The system analyzes events for:

- **Transfer events**: Token movements
- **Approval events**: Token approvals
- **Role events**: Access control changes
- **Pause events**: Emergency state changes
- **Swap events**: Trading operations
- **Param events**: Configuration updates

## Gas Analysis

### Summary Metrics

The `gas-summary.csv` provides:

```csv
Contract,Function,AvgGas,MaxGas,Calls
InstantLane,instantRedeem,125000,150000,50
ConfigRegistry,setParam,45000,50000,10
```

### Budget Checking

Gas budgets are enforced via `scripts/check-gas-budget.ts`:

```bash
# Check against budgets
yarn gas:budget

# Enforce budgets (fail on breach)
GAS_BUDGET_ENFORCE=true yarn gas:budget
```

## Security Considerations

### No Secrets

Audit bundles contain **no sensitive information**:

- ✅ Public contract bytecode
- ✅ Public test fixtures
- ✅ Public gas reports
- ✅ Public event documentation
- ❌ No private keys
- ❌ No API secrets
- ❌ No internal addresses

### Integrity

All artifacts include integrity checks:

- **SHA256 hashes**: For all files
- **Tree hashes**: For fixture collections
- **Bundle hashes**: For complete bundles
- **Git commits**: For source verification

## Troubleshooting

### Common Issues

1. **Missing artifacts**: Ensure contracts are compiled
2. **Hash mismatches**: Regenerate fixtures if needed
3. **Bundle creation fails**: Check disk space and permissions
4. **CI failures**: Verify all dependencies are installed

### Manual Override

If automatic generation fails:

```bash
# Force test attestation
AUDIT_ATTEST_RUN=1 yarn audit:tests

# Regenerate specific artifacts
yarn audit:manifest
yarn audit:fixtures
yarn audit:events
```

## Future Enhancements

- **IPFS integration**: Immutable storage of bundles
- **Blockchain anchoring**: On-chain bundle hashes
- **Automated verification**: CI-based bundle validation
- **Cross-bundle analysis**: Trend analysis across releases
- **Security scanning**: Automated vulnerability detection


