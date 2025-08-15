#!/usr/bin/env bash
set -euo pipefail
fail=0

# Ignore commented lines when grepping
filter_comments() { grep -v '^\s*#' || true; }

staged_files=$(git diff --cached --name-only | filter_comments)

# Skip checks if nothing staged
if [[ -z "${staged_files}" ]]; then
  exit 0
fi

# flag parseEther for USDC amounts in issuance tests (but allow BRICS token amounts)
hits=$(git diff --cached --name-only \
  | grep -E '^test/issuance.*\.spec\.ts$' \
  | xargs -r grep -n "parseEther(" \
  | grep -E "(usdc\.|USDC|await usdc\.|\.usdc\.)" \
  | grep -v '^\s*//' || true)
if [[ -n "$hits" ]]; then
  echo "❌ Found parseEther() for USDC amounts in issuance tests. Use USDC(...) helper instead:"
  echo "$hits"
  fail=1
fi

# flag direct oracle calls in tests
oracle_hits=$(git diff --cached --name-only \
  | grep -E '^test/.*\.spec\.ts$' \
  | xargs -r grep -n -E "\.(navRay|latestNAVRay|getNavRay|setNAV|setNavRay)\(" \
  | grep -v '^\s*//' || true)
if [[ -n "$oracle_hits" ]]; then
  echo "❌ Found direct oracle calls in tests. Use setNavCompat/getNavRayCompat from nav-helpers:"
  echo "$oracle_hits"
  fail=1
fi

# flag BigInt → Number coercions in tests
number_hits=$(git diff --cached --name-only \
  | grep -E '^test/.*\.spec\.ts$' \
  | xargs -r grep -n -E "\.toNumber\(|Number\(" \
  | grep -E "(usdc|nav|tokens|amount)" \
  | grep -v '^\s*//' || true)
if [[ -n "$number_hits" ]]; then
  echo "❌ Found BigInt→Number coercions in tests. Avoid Number(..) on BigInt; keep as bigint or use helper formatters:"
  echo "$number_hits"
  fail=1
fi

# Disallow new .skip in tests unless line has TODO(…) justification
skipped=$(git diff --cached -U0 -- test | grep -nE "^\+.*\.(describe|it)\.skip\(" | grep -v "TODO(" || true)
if [[ -n "$skipped" ]]; then
  echo "❌ Found new .skip without TODO(...):"
  echo "$skipped"
  fail=1
fi

# Block support/ directory additions (large artifacts)
support_hits=$(git diff --cached --name-only | grep -E '^support/' || true)
if [[ -n "$support_hits" ]]; then
  echo "❌ Found support/ directory additions. These are large artifacts that should not be committed:"
  echo "$support_hits"
  echo "Please remove these files and add support/ to .gitignore if not already present."
  fail=1
fi

# Disallow Yarn 1.x install flag in workflows (use --immutable with Yarn 4)
bad_flag=$(git diff --cached --name-only | grep -E '^\.github/workflows/.*\.yml$' | xargs -r grep -n -- '--frozen-lockfile' || true)
if [[ -n "$bad_flag" ]]; then
  echo "❌ Found '--frozen-lockfile' in workflow(s). Use 'yarn install --immutable' with Yarn 4/Corepack."
  echo "$bad_flag"
  fail=1
fi

# Block legacy Yarn v1 flag
bad_frozen=$(echo "$staged_files" | xargs -I{} grep -nH -- '--frozen-lockfile' {} 2>/dev/null | grep -v 'scripts/check-usdc-ether\.sh' || true)
if [[ -n "$bad_frozen" ]]; then
  echo "❌ Found '--frozen-lockfile' (use '--immutable' with Yarn 4):"
  echo "$bad_frozen"
  fail=1
fi

# Block CLI reporter flag (Hardhat HH305)
bad_reporter=$(echo "$staged_files" | xargs -I{} grep -nH -E 'yarn\s+test.*--reporter\s+min' {} 2>/dev/null | grep -v 'scripts/check-usdc-ether\.sh' || true)
if [[ -n "$bad_reporter" ]]; then
  echo "❌ Found 'yarn test --reporter min' (set reporter in hardhat.config.ts instead):"
  echo "$bad_reporter"
  fail=1
fi

exit $fail
