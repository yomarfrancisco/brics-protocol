#!/usr/bin/env bash
set -euo pipefail

echo "==> Preparing Yarn"
corepack enable
corepack prepare yarn@4.9.2 --activate
yarn --version

echo "==> Installing deps"
yarn install --immutable

echo "==> Running dev bootstrap"
yarn hardhat dev:bootstrap

echo "==> Addresses"
cat .devstack/addresses.json || true

echo "==> Risk API setup (if present)"
if [ -d "risk_api" ]; then
  # Create .env if not present
  if [ ! -f "risk_api/.env" ]; then
    cat > risk_api/.env << EOF
# BRICS Risk API Configuration
RISK_API_ED25519_SK_HEX=000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f

# NAV Oracle Configuration
NAV_RAY=1000000000000000000000000000
NAV_MODEL_HASH=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
EMERGENCY_NAV_RAY=1000000000000000000000000000
EMERGENCY_ENABLED=0

# Emergency State Configuration
EMERGENCY_LEVEL=0
EMERGENCY_REASON=normal

# Issuance Controller Configuration
ISS_LOCKED=0
ISS_CAP_TOKENS=4440000000000000000000000
ISS_DETACH_BPS=10200
ISS_RATIFY_UNTIL=0

# Risk Metrics Configuration
RISK_DEFAULTS_BPS=300
RISK_SOVEREIGN_USAGE_BPS=0
RISK_CORRELATION_BPS=250

# Server Configuration
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info
EOF
    echo "Created risk_api/.env"
  fi
  
  echo "==> Risk API test endpoints"
  echo "curl \"http://localhost:8000/api/v1/lane/pretrade?price_bps=10050&emergency_level=0\""
  echo "curl \"http://localhost:8000/api/v1/oracle/nav-sanity?prev_nav_ray=1000000000000000000000000000&proposed_nav_ray=1049000000000000000000000000&max_jump_bps=500&emergency=0\""
fi

echo "Done."
