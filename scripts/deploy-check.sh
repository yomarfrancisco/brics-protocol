#!/usr/bin/env bash
set -euo pipefail

NET=${1:-localhost}
PARAMS="deployment/${NET}.params.json"
ADDRS="deployment/${NET}.addresses.json"

echo "🚀 Running deploy-check on $NET..."

echo "📦 Deploying core contracts..."
if ! npx hardhat deploy:core --params $PARAMS --network $NET; then
  echo "❌ Core deployment failed"
  exit 1
fi

echo "🔗 Wiring roles..."
if ! npx hardhat roles:wire --params $PARAMS --addresses $ADDRS --network $NET; then
  echo "❌ Role wiring failed"
  exit 1
fi

echo "🔍 Auditing roles..."
if ! npx hardhat roles:audit --addresses $ADDRS --params $PARAMS --network $NET; then
  echo "❌ Role audit failed"
  exit 1
fi

echo "📊 Generating status report..."
if ! npx ts-node scripts/status.ts --network $NET --addresses $ADDRS; then
  echo "❌ Status report generation failed"
  exit 1
fi

# Run fork rehearsal if on localhost (fork)
if [ "$NET" = "localhost" ]; then
  echo "🎭 Running fork rehearsal..."
  if ! npx ts-node scripts/fork-rehearsal.ts; then
    echo "❌ Fork rehearsal failed"
    exit 1
  fi
fi

echo "✅ deploy-check OK on $NET"
echo ""
echo "📄 Generated files:"
echo "   • deployment/${NET}.addresses.json"
echo "   • audit/roles-audit.json"
echo "   • audit/status-${NET}.json"
if [ "$NET" = "localhost" ]; then
  echo "   • audit/fork-rehearsal.json"
fi
