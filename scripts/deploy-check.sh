#!/usr/bin/env bash
set -euo pipefail

NET=${1:-localhost}
PARAMS="deployment/${NET}.params.json"
ADDRS="deployment/${NET}.addresses.json"

echo "🚀 Running deploy-check on $NET..."

echo "📦 Deploying core contracts..."
npx hardhat deploy:core --params $PARAMS --network $NET

echo "🔗 Wiring roles..."
npx hardhat roles:wire --params $PARAMS --addresses $ADDRS --network $NET

echo "🔍 Auditing roles..."
npx hardhat roles:audit --addresses $ADDRS --network $NET

echo "🧪 Running invariant tests..."
npm run test -- --grep "Invariants"

echo "✅ deploy-check OK on $NET"
