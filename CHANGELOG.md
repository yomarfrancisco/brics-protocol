# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-12

### Changed
- **Promoted rc1 → v0.1.0**: Stabilized release with enhanced security and observability
- **Added smoke CI**: Fresh-clone validation for reproducible builds
- **Added SBOM**: Software Bill of Materials for dependency tracking
- **Enhanced provider fence**: Explicit bank provider guard with logging
- **Added observability hooks**: Verbose demo output for development debugging
- **Improved documentation**: CODEOWNERS, CONTRIBUTING, SECURITY guidelines

### Security
- **Bank provider fencing**: Explicit guard prevents accidental bank data access
- **License header validation**: Automated checks for SPDX headers
- **Enhanced security docs**: Clear reporting guidelines and best practices

### CI
- **Smoke test job**: Fresh-clone validation on PR and main
- **Release artifacts**: SBOM and demo output generation
- **License compliance**: Non-blocking header validation

## [0.1.0-rc1] - 2025-08-12

### Added
- **Pricing Service**: Deterministic pricing service with FastAPI backend
  - Baseline risk model with configurable features
  - EIP-191 signature verification
  - CLI interface for testing and development
  - Golden vector generation for deterministic testing
- **Compliance Service**: KYC/AML mock service
  - Mock KYC verification with configurable risk levels
  - Mock AML screening with customizable flags
  - CLI interface for testing
  - JSON output for integration testing
- **CDS Swap Module**: Complete credit default swap implementation (P1.4–P1.7)
  - `CdsSwapEngine`: Core swap lifecycle management
  - `CdsSwapRegistry`: Swap metadata storage
  - `ICdsSwap` & `ICdsSwapEvents`: Interface definitions
  - RBAC with `GOV_ROLE` and `BROKER_ROLE`
  - Token settlement with SafeERC20
  - Payout calculation based on spread difference
- **Replay Harness**: Deterministic end-to-end testing (P1.8)
  - Replay pricing provider for fixture-based testing
  - Deterministic fixture generation with checksums
  - Signer parity verification
  - Drift detection and prevention
  - CI integration with artifact uploads

### Security
- **BANK_DATA_MODE guard**: Explicit opt-in required for bank data access
  - Bank provider disabled by default
  - Must set `BANK_DATA_MODE=live` to enable
  - Prevents accidental bank data exposure
- **SafeERC20 in settlement**: Secure token transfers
  - Uses OpenZeppelin's SafeERC20 for all token operations
  - Prevents reentrancy and approval issues
  - Validates token contract addresses

### CI
- **Replay determinism**: Fully deterministic CI testing
  - No external network calls in CI
  - Deterministic fixture generation
  - Checksum validation prevents drift
- **Signer parity**: Oracle verification
  - Fixture signer == adapter.riskOracle() enforced
  - Signature recovery verification
  - EIP-191 compliance checks
- **Checksum drift guard**: Prevents accidental changes
  - SHA-256 checksums for all fixtures
  - Automated drift detection
  - CI failure on checksum mismatch

### Changed
- **Pricing facade**: Provider abstraction layer
  - Support for stub, fastapi, replay, and bank providers
  - Environment-based provider selection
  - Deterministic stub provider for testing
- **CI workflow**: Streamlined and hardened
  - Required jobs: replay E2E, pricing service, compliance service
  - Optional jobs: coverage and gas reporting (nightly)
  - Corepack and Node.js version pinning

### Fixed
- **Signature verification**: On-chain vs off-chain parity
  - Fixed digest computation mismatch
  - Corrected EIP-191 prefixing
  - Aligned payload structure between providers
- **Timestamp handling**: Freshness window management
  - Proper asOf timestamp calculation
  - CI time skew tolerance
  - Future timestamp validation

### Infrastructure
- **Development tooling**: One-command setup and testing
  - `make bootstrap`: Complete environment setup
  - `make e2e-replay`: Deterministic demo
  - `make pricing:serve`: Local service startup
  - `make test`: Full test suite execution
