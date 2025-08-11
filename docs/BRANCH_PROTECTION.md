# Main Branch Protection Requirements

## Overview
This document outlines the required branch protection settings for the `main` branch to ensure code quality and security standards are maintained.

## Required CI Checks

The following CI checks must pass before any PR can be merged to `main`:

### 1. Unit & Integration Tests
- **Job Name**: `ci/Unit & Integration Tests`
- **Purpose**: Ensures all unit and integration tests pass
- **Timeout**: 30 minutes
- **Artifacts**: Gas report (if generated)

### 2. Coverage (Fast Track)
- **Job Name**: `ci/Coverage (fast track)`
- **Purpose**: Validates code coverage meets minimum thresholds
- **Coverage Target**: Fast floor (see `ci/coverage-baseline.json`)
- **Timeout**: 30 minutes
- **Artifacts**: Coverage reports (lcov.info, coverage.json)

### 3. Gas Report
- **Job Name**: `ci/Gas Report`
- **Purpose**: Generates gas usage reports for contract optimization
- **Timeout**: 20 minutes
- **Artifacts**: Gas report (gas-report.txt)

### 4. Security (Slither + SARIF)
- **Job Name**: `ci/Security (Slither + SARIF)`
- **Purpose**: Static analysis security scanning with SARIF reporting
- **Features**: 
  - Hardhat compilation + Slither analysis
  - Fallback SARIF generation
  - Allowlist filtering
  - High-severity issue gating
  - GitHub Security integration
- **Timeout**: 30 minutes
- **Artifacts**: SARIF files, security reports

## Branch Protection Settings

### Required Status Checks
Enable the following status checks as required:

```
ci/Unit & Integration Tests
ci/Coverage (fast track)
ci/Gas Report
ci/Security (Slither + SARIF)
```

### Additional Protection Rules

1. **Require branches to be up to date before merging**
   - Ensures PRs are tested against the latest main branch

2. **Require pull request reviews before merging**
   - At least 1 approving review required
   - Dismiss stale PR approvals when new commits are pushed

3. **Restrict pushes that create files larger than 100 MB**
   - Prevents large file uploads that could impact repository performance

4. **Require linear history**
   - Ensures clean, linear commit history for easier debugging and rollbacks

5. **Include administrators**
   - Apply these rules to repository administrators as well

## Implementation Notes

- These settings should be configured in the repository's Settings > Branches > Add rule
- The CI checks are defined in `.github/workflows/ci.yml`
- Coverage thresholds are managed in `ci/coverage-baseline.json`
- Security allowlist is maintained in `audit/slither-allowlist.json`

## Monitoring

- Monitor CI job success rates in GitHub Actions
- Review coverage trends over time
- Track security findings and allowlist growth
- Ensure gas reports show optimization opportunities
