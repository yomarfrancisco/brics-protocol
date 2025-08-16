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

# 6) TODO/FIXME markers (case-insensitive, exclude docs/README/CHANGELOG/.md)
section "TODO/FIXME markers (excluding docs/README/CHANGELOG/.md)"
grep -RIni 'TODO|FIXME' -- src test 2>/dev/null \
  | grep -Ev '(docs/|README|CHANGELOG|\.md$)' || true | tee -a guardrails-report.txt

# 7) hardhat/console imports
section "hardhat/console imports"
grep -RInE '(require|import).*hardhat/console' -- src test || true | tee -a guardrails-report.txt

# 8) Mocha "only" markers (backup to .only check)
section "mocha only markers (backup)"
grep -RInE '\.only\(' -- src test || true | tee -a guardrails-report.txt

echo
if [ -s guardrails-report.txt ]; then
  echo "Guardrails findings captured above (non-blocking)."
else
  echo "No guardrails findings."
fi

# ---- summary (logs) ----
if [ -f guardrails-report.txt ]; then
  sec_count () {
    # print lines between "== <section> ==" and next "== " section, count non-empty
    awk "/^== $1 ==/{flag=1;next}/^== /{flag=0} flag" guardrails-report.txt | grep -c . || true
  }
  c_time=$(sec_count "raw time ops (evm_*)")
  c_ray=$(sec_count "legacy RAY math (parseEther(...) * 10n ** 9n)")
  c_only=$(sec_count "focused tests (.only)")
  c_log=$(sec_count "console.log in tests")
  c_addr=$(sec_count "hardcoded 0x addresses (excluding mocks/fixtures/json)")
  c_todo=$(sec_count "TODO/FIXME markers (excluding docs/README/CHANGELOG/.md)")
  c_console=$(sec_count "hardhat/console imports")
  c_mocha=$(sec_count "mocha only markers (backup)")
  echo "::group::Guardrails summary"
  echo "RAW EVM TIME OPS:     $c_time"
  echo "LEGACY RAY MATH:      $c_ray"
  echo "FOCUSED TESTS (.only):$c_only"
  echo "CONSOLE LOGS:         $c_log"
  echo "HARDCODED 0x ADDRS:   $c_addr"
  echo "TODO/FIXME MARKERS:   $c_todo"
  echo "HARDHAT/CONSOLE:      $c_console"
  echo "MOCHA ONLY MARKERS:   $c_mocha"
  echo "::endgroup::"
fi
