#!/bin/bash
set -euo pipefail

echo "🧪 Running fresh clone smoke test..."

echo "📦 Enabling corepack..."
corepack enable

echo "📦 Installing dependencies..."
yarn install --immutable

echo "🔧 Running bootstrap..."
make bootstrap

echo "🎯 Running E2E replay demo..."
make e2e-replay

echo "✅ Smoke test completed successfully!"
