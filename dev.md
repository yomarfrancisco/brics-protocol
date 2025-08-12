# BRICS Protocol - 5-Minute Quickstart

## Setup (One Command)

```bash
make bootstrap
```

This sets up everything:
- Node.js with correct Yarn version (corepack)
- Python virtual environments for pricing/compliance services
- Pre-commit hooks (if available)

## Run E2E Demo (One Command)

```bash
make e2e-replay
```

This runs a complete CDS swap lifecycle with deterministic replay fixtures (no external dependencies).

## Provider Switching

| Provider | Command | Use Case | Network | Bank Data |
|----------|---------|----------|---------|-----------|
| **stub** | `PRICING_PROVIDER=stub make e2e-replay` | CI, testing | ❌ | ❌ |
| **fastapi** | `PRICING_PROVIDER=fastapi make e2e-replay` | Local dev | ✅ (local) | ❌ |
| **replay** | `PRICING_PROVIDER=replay make e2e-replay` | Dev parity | ❌ | ❌ |
| **bank** | `BANK_DATA_MODE=live PRICING_PROVIDER=bank make e2e-replay` | Production | ✅ | ✅ (explicit) |

## Start Pricing Service

```bash
make pricing:serve
```

Runs FastAPI pricing service locally on port 8001.

## Run Tests

```bash
make test
```

Runs the full test suite.

## Key Files

- `docs/e2e-demo.md` - Detailed demo documentation
- `docs/REPO_MAP.md` - Repository overview
- `docs/ADR/` - Architecture Decision Records
- `pricing-fixtures/` - Deterministic replay fixtures
