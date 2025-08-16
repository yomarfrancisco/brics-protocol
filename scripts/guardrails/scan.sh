#!/usr/bin/env bash
set -euo pipefail

: > guardrails-report.txt

section () { echo "==== $1 ====" | tee -a guardrails-report.txt; }

# 1) Raw EVM time ops
section "raw time ops (evm_*)"
grep -RInE 'evm_(increaseTime|setNextBlockTimestamp|mine)\(' -- test || true | tee -a guardrails-report.txt

# 2) Legacy RAY math
section "legacy RAY math (parseEther(...) * 10n ** 9n)"
grep -RInE 'parseEther\("1(\.[0-9]+)?"\)\s*\*\s*10n\s*\*\*\s*9n' -- test || true | tee -a guardrails-report.txt

# 3) Focused tests (.only)
section "focused tests (.only)"
grep -RInE '\b(it|describe)\.only\(' -- test || true | tee -a guardrails-report.txt

# 4) console.log in tests
section "console.log in tests"
grep -RInE 'console\.log\(' -- test || true | tee -a guardrails-report.txt

# 5) Hardcoded addresses (exclude mocks/fixtures/json)
section "hardcoded 0x addresses (excluding mocks/fixtures/json)"
grep -RInE '0x[a-fA-F0-9]{40}' -- test contracts 2>/dev/null \
  | grep -Ev '(mocks?/|Mock|fixtures?/|\.json$)' || true | tee -a guardrails-report.txt

echo
if [ -s guardrails-report.txt ]; then
  echo "Guardrails findings captured above (non-blocking)."
else
  echo "No guardrails findings."
fi
