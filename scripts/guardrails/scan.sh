#!/usr/bin/env bash
set -euo pipefail
echo "[guard] time ops:"
git grep -n "evm_increaseTime\|evm_setNextBlockTimestamp\|evm_mine" -- test || true
echo "[guard] legacy RAY:"
git grep -n 'parseEther("1\.[0-9]+") \* 10n \*\* 9n\|parseEther("1\.0") \* 10n \*\* 9n' -- test || true
