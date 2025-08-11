#!/usr/bin/env bash
set -euo pipefail

THRESHOLD="${1:-70}"

if [ ! -f coverage.json ]; then
  echo "coverage.json not found"; exit 1
fi

# Calculate coverage manually from coverage.json structure
TOTAL_LINE=$(node -pe "
  const cov = require('./coverage.json');
  let totalLines = 0;
  let coveredLines = 0;
  Object.values(cov).forEach(file => {
    if (file.l) {
      Object.values(file.l).forEach(hit => {
        totalLines++;
        if (hit > 0) coveredLines++;
      });
    }
  });
  totalLines > 0 ? (coveredLines * 100 / totalLines).toFixed(2) : '0'
")

TOTAL_STAT=$(node -pe "
  const cov = require('./coverage.json');
  let totalStatements = 0;
  let coveredStatements = 0;
  Object.values(cov).forEach(file => {
    if (file.s) {
      Object.values(file.s).forEach(hit => {
        totalStatements++;
        if (hit > 0) coveredStatements++;
      });
    }
  });
  totalStatements > 0 ? (coveredStatements * 100 / totalStatements).toFixed(2) : '0'
")

# Strip decimals
LINE_INT=${TOTAL_LINE%.*}
STAT_INT=${TOTAL_STAT%.*}

echo "Coverage — lines: ${TOTAL_LINE}% | statements: ${TOTAL_STAT}% | required ≥ ${THRESHOLD}%"

if [ "$LINE_INT" -lt "$THRESHOLD" ] || [ "$STAT_INT" -lt "$THRESHOLD" ]; then
  echo "Coverage below threshold"; exit 1
fi
echo "Coverage meets threshold ✅"
