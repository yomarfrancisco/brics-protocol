#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/repro/replay.sh [--fixture path/to/fixture.json]
# Defaults to pricing-fixtures/ACME-LLC-30-latest.json if present.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FIX="${1:-}"
if [[ "$FIX" == "--fixture" ]]; then
  FIX="$2"
fi

if [[ -z "${FIX}" ]]; then
  if [[ -f "pricing-fixtures/ACME-LLC-30-latest.json" ]]; then
    FIX="pricing-fixtures/ACME-LLC-30-latest.json"
  elif [[ -f "ci-artifacts/replay/ACME-LLC-30-latest.json" ]]; then
    FIX="ci-artifacts/replay/ACME-LLC-30-latest.json"
  else
    echo "Fixture not found. Pass explicitly with --fixture <path>."
    exit 1
  fi
fi

echo "[repro] Using fixture: $FIX"

# Corepack/Yarn pin (idempotent)
corepack enable >/dev/null 2>&1 || true
corepack prepare yarn@4.9.2 --activate

# Install if needed
if [[ ! -d ".yarn" && ! -d "node_modules" ]]; then
  yarn install --immutable
fi

# Optional signer override (kept empty by default; test helpers will fall back)
# export CI_SIGNER_PRIVKEY=0x...

# Hashcheck all frozen fixtures (auto-scan)
yarn fixtures:hashcheck

# Run replay
PRICING_PROVIDER=replay BANK_DATA_MODE=off FIXTURE_PATH="$FIX" yarn test:replay
