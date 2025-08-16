#!/bin/bash

# Mission: Build a single, review-ready zip for Issue #61 deep-dive
# Output: support/#61-mintfor-deepdive-<shortsha>.zip

set -euo pipefail

# 0) Find repo root
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

SHORTSHA="$(git rev-parse --short HEAD || echo no-git)"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
OUTDIR="support/#61-mintfor-deepdive-${SHORTSHA}"
ZIPNAME="${OUTDIR}.zip"

# 1) Curate file list (explicit + discovered)
explicit_paths=(
  "contracts/IssuanceControllerV3.sol"
  "contracts/interfaces/IIssuanceControllerV3.sol"
  "contracts/libraries/IssuanceGuard.sol"
  "contracts/ConfigRegistry.sol"
  "contracts/sovereign"
  "contracts/token"
  "contracts/mocks/MockNAVOracle.sol"
  "contracts/oracles/NAVOracleV3.sol"
  "test/issuance.capacity.boundary.spec.ts"
  "test/issuance.capacity.fuzz.spec.ts"
  "test/issuance.v3.spec.ts"
  "test/sovereign.guarantee.spec.ts"
  "test/security/precision.spec.ts"
  "test/security/reentrancy.spec.ts"
  "test/utils/nav-helpers.ts"
  "test/utils"
  "test/**/fixtures"
  "hardhat.config.ts"
  "hardhat.config.js"
  "package.json"
  "yarn.lock"
  "package-lock.json"
  ".solhint.json" ".solhintignore"
  ".eslintrc.js" ".eslintrc.cjs" ".eslintrc.json"
  ".prettierrc" ".prettierrc.js" ".prettierrc.cjs" ".prettier.config.js"
)

# 1b) Discover any other sources touching 'mintFor' to avoid missing edge deps
discovered_mintfor=()
while IFS= read -r line; do
  discovered_mintfor+=("$line")
done < <(grep -r "mintFor[[:space:]]*(" --exclude-dir=node_modules --exclude-dir=artifacts --exclude-dir=cache . 2>/dev/null | cut -d: -f1 | sort -u || true)

# 1c) Discover any contract libs the controller imports
controller_imports=()
while IFS= read -r line; do
  controller_imports+=("$line")
done < <(grep -n '^import[[:space:]]\+.*;' contracts/IssuanceControllerV3.sol 2>/dev/null | awk '{print $2}' | tr -d '";' | sed 's/^/@/' || true)
# the above may not resolve to files—so also pull all library files in contracts/libraries just in case
explicit_paths+=("contracts/libraries")

# 2) Build a staging folder mirroring structure (skip missing)
rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

copy_safe() {
  local p="$1"
  # expand globs safely
  shopt -s nullglob dotglob
  for f in $p; do
    if [ -e "$f" ]; then
      d="${OUTDIR}/$(dirname "$f")"
      mkdir -p "$d"
      cp -R "$f" "$d"/
    fi
  done
  shopt -u nullglob dotglob
}

for p in "${explicit_paths[@]}"; do copy_safe "$p"; done
for p in "${discovered_mintfor[@]}"; do copy_safe "$p"; done

# 3) Create an index file summarizing what's included & useful grep
mkdir -p "$OUTDIR/_index"
{
  echo "Issue #61 deep-dive bundle"
  echo "Created: ${STAMP}"
  echo "Commit: ${SHORTSHA}"
  echo
  echo "== Included files (tree) =="
  (cd "$OUTDIR" && find . -type f | sort)
  echo
  echo "== grep: where 'mintFor(' appears =="
  grep -r -n "mintFor[[:space:]]*(" "$OUTDIR" || true
  echo
  echo "== grep: where 'AmountZero' appears =="
  grep -r -n "AmountZero" "$OUTDIR" || true
  echo
  echo "== grep: where 'setNav'/'navRay' API appears =="
  grep -r -n "setNAV\|setNavRay\|navRay\|latestNAVRay\|getNavRay" "$OUTDIR" || true
} > "$OUTDIR/_index/README.txt"

# 4) Zip it
rm -f "$ZIPNAME"
zip -qr "$ZIPNAME" "$OUTDIR"

# 5) Output paths & a quick summary
echo
echo "Bundle ready:"
echo " - Folder: $OUTDIR"
echo " - Zip:    $ZIPNAME"
echo
echo "Top-level contents:"
find "$OUTDIR" -maxdepth 2 -type f | sort
