# BRICS Protocol Admin Scripts

## Overview
This document provides operational runbooks and CLI scripts for BRICS Protocol administrators. All scripts require appropriate role permissions and should be executed with caution.

## Prerequisites
- Node.js 18+ and Yarn installed
- Access to BRICS Protocol contracts
- Appropriate role permissions (OPS_ROLE, GOV_ROLE, ECC_ROLE)
- Environment variables configured

## Emergency Level Management

### Check Current Emergency Level
```bash
# Check current emergency state
yarn hardhat run scripts/checkEmergency.ts

# Expected output:
# Current emergency level: NORMAL
# Time in state: 86400 seconds
# Next assessment: 1641081600
```

### Set Emergency Level
```bash
# Set emergency level (requires ECC_ROLE)
yarn hardhat run scripts/setEmergencyLevel.ts --level YELLOW

# Available levels: NORMAL, YELLOW, ORANGE, RED
# Requires ECC_ROLE or higher
```

### Emergency Level Escalation
```bash
# Automatic escalation based on triggers
yarn hardhat run scripts/emergencyEscalation.ts

# Manual override (super emergency only)
yarn hardhat run scripts/emergencyOverride.ts --level RED --reason "systemic_crisis"
```

## Mezzanine Vault Management

### MezzVault4626 Operations

#### Check Vault Status
```bash
# Check current vault state
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-status.ts

# Expected output:
# === Mezzanine Vault Status ===
# Total Assets: 1000000000000000000000000
# Total Shares: 1000000000000000000000000
# Paused: false
# Config Registry: 0x...
# Lock Duration: 1576800000 (5 years)
# Grace Window: 2592000 (30 days)
```

#### Lock Management
```bash
# Check user lock status
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-lock.ts --user 0x...

# Force unlock specific users (EMERGENCY_ROLE only)
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/force-unlock.ts --users 0x...,0x...,0x...

# Check multiple user locks
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-locks.ts --users 0x...,0x...,0x...
```

#### Whitelist Management
```bash
# Add user to operational whitelist
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/set-whitelist.ts --user 0x... --whitelisted true

# Remove user from whitelist
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/set-whitelist.ts --user 0x... --whitelisted false

# Check whitelist status
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-whitelist.ts --user 0x...
```

#### Emergency Controls
```bash
# Pause vault operations
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/pause.ts

# Unpause vault operations
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/unpause.ts

# Check pause status
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-pause.ts
```

#### Configuration Management
```bash
# Update ConfigRegistry address
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/set-config-registry.ts --registry 0x...

# Check current configuration
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/check-config.ts
```

### Operational Runbooks

#### Change Lock/Grace via ConfigRegistry
```bash
# 1. Check current lock settings
CONFIG_ADDRESS=0x... yarn hardhat run scripts/config/check-keys.ts --keys mezz.lock.durationSec,mezz.lock.graceSec

# 2. Update lock duration (e.g., to 3 years)
CONFIG_ADDRESS=0x... yarn hardhat run scripts/config/set-uint.ts --key mezz.lock.durationSec --value 94608000

# 3. Update grace window (e.g., to 14 days)
CONFIG_ADDRESS=0x... yarn hardhat run scripts/config/set-uint.ts --key mezz.lock.graceSec --value 1209600

# 4. Verify changes
CONFIG_ADDRESS=0x... yarn hardhat run scripts/config/check-keys.ts --keys mezz.lock.durationSec,mezz.lock.graceSec

# 5. Test with new vault deployment
yarn hardhat run scripts/mezz/test-config.ts --vault 0x...
```

#### Emergency Force Unlock
```bash
# 1. Identify users requiring emergency unlock
yarn hardhat run scripts/mezz/audit-locks.ts --vault 0x...

# 2. Review unlock candidates (audit required)
yarn hardhat run scripts/mezz/review-unlock-candidates.ts --vault 0x... --users 0x...,0x...,0x...

# 3. Execute force unlock (EMERGENCY_ROLE only)
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/force-unlock.ts --users 0x...,0x...,0x...

# 4. Verify unlock execution
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/verify-unlock.ts --users 0x...,0x...,0x...

# 5. Monitor post-unlock activity
yarn hardhat run scripts/mezz/monitor-unlocked-users.ts --vault 0x... --users 0x...,0x...,0x...
```

#### Pause/Unpause Procedures
```bash
# Emergency Pause Procedure
# 1. Assess situation requiring pause
yarn hardhat run scripts/mezz/assess-pause-need.ts --vault 0x...

# 2. Execute pause (GOV_ROLE only)
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/pause.ts

# 3. Verify pause execution
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/verify-pause.ts

# 4. Monitor paused state
yarn hardhat run scripts/mezz/monitor-paused.ts --vault 0x...

# Recovery Unpause Procedure
# 1. Assess readiness to unpause
yarn hardhat run scripts/mezz/assess-unpause-readiness.ts --vault 0x...

# 2. Execute unpause (GOV_ROLE only)
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/unpause.ts

# 3. Verify unpause execution
VAULT_ADDRESS=0x... yarn hardhat run scripts/mezz/verify-unpause.ts

# 4. Monitor post-unpause operations
yarn hardhat run scripts/mezz/monitor-post-unpause.ts --vault 0x...
```

### Monitoring and Alerts

#### Key Metrics
- **Total Assets Under Lock**: Total value locked in vault
- **Lock Distribution**: Distribution of unlock timestamps
- **Grace Window Utilization**: Users withdrawing within grace window
- **Emergency Unlocks**: Count and frequency of force unlocks
- **Whitelist Usage**: Operational whitelist activity

#### Alert Thresholds
- **Grace Window Approaching**: Users approaching grace window expiry
- **High Lock Concentration**: Single user with >10% of total locked value
- **Emergency Unlock Frequency**: >5 force unlocks in 24h period
- **Pause Duration**: Vault paused for >24h
- **Config Changes**: Lock duration or grace window modifications

#### Monitoring Commands
```bash
# Daily vault health check
yarn hardhat run scripts/mezz/health-check.ts --vault 0x...

# Weekly lock distribution analysis
yarn hardhat run scripts/mezz/lock-distribution.ts --vault 0x...

# Monthly emergency procedure review
yarn hardhat run scripts/mezz/emergency-review.ts --vault 0x...

# Continuous monitoring
yarn hardhat run scripts/mezz/monitor-continuous.ts --vault 0x...
```

### Configuration Parameters

#### ConfigRegistry Keys
- `keccak256("mezz.lock.durationSec")` → Lock duration in seconds (default: 5 years)
- `keccak256("mezz.lock.graceSec")` → Grace window in seconds (default: 30 days)

#### Default Values
- **Lock Duration**: 5 years (157,680,000 seconds)
- **Grace Window**: 30 days (2,592,000 seconds)
- **Role Requirements**: GOV_ROLE for config, EMERGENCY_ROLE for force unlock

### Audit and Compliance

#### Lock Audit Procedures
```bash
# Comprehensive lock audit
yarn hardhat run scripts/mezz/audit-locks-comprehensive.ts --vault 0x...

# Grace window compliance check
yarn hardhat run scripts/mezz/audit-grace-windows.ts --vault 0x...

# Emergency unlock audit trail
yarn hardhat run scripts/mezz/audit-emergency-unlocks.ts --vault 0x...
```

#### Compliance Reporting
```bash
# Generate compliance report
yarn hardhat run scripts/mezz/generate-compliance-report.ts --vault 0x...

# Export lock data for external audit
yarn hardhat run scripts/mezz/export-lock-data.ts --vault 0x...

# Validate governance procedures
yarn hardhat run scripts/mezz/validate-governance.ts --vault 0x...
```

## Adaptive Issuance Controls

### IssuanceControllerV4 Management

#### Check Current State
```bash
# Check current issuance controller state
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-state.ts

# Expected output:
# === Issuance Controller State ===
# Super Senior Cap: 1000000000000000000000000
# Detachment BPS: 10100
# Issuance Locked: false
# Pending Ratify Until: 0
# Emergency Level: 0
# Can Mint 1000 tokens: true
```

#### Detachment Management
```bash
# Raise detachment with ratification window
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/raise-detachment.ts --detachment 10200

# Ratify detachment within 24h window
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/ratify-detachment.ts

# Lower detachment (requires cooldown and no pending ratification)
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/lower-detachment.ts --detachment 10000

# Check detachment status
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-detachment.ts
```

#### Emergency Controls
```bash
# Lock issuance (ECC_ROLE only)
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/lock-issuance.ts

# Unlock issuance (ECC_ROLE only)
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/unlock-issuance.ts

# Set emergency level to RED (halt all issuance)
CONFIG_ADDRESS=0x... yarn hardhat run scripts/issuance/set-emergency-red.ts

# Check emergency status
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-emergency.ts
```

#### Cap Management
```bash
# Adjust super senior cap
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/adjust-cap.ts --cap 2000000000000000000000000

# Check cap utilization
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-cap-utilization.ts
```

#### Trigger Management
```bash
# Manually trigger risk adjustments
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/adjust-triggers.ts --defaults 600 --sovereign 2500 --correlation 7000

# Check trigger thresholds
yarn hardhat run scripts/issuance/check-triggers.ts

# Monitor trigger conditions
yarn hardhat run scripts/issuance/monitor-triggers.ts
```

### Operational Runbooks

#### Raise Detachment & Ratify Flow
```bash
# 1. Check current state
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-state.ts

# 2. Raise detachment
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/raise-detachment.ts --detachment 10200

# 3. Monitor ratification window (24h)
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-detachment.ts

# 4. Ratify within window
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/ratify-detachment.ts

# 5. Verify ratification
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-state.ts
```

#### Emergency RED Halt Minting
```bash
# 1. Set emergency level to RED
CONFIG_ADDRESS=0x... yarn hardhat run scripts/issuance/set-emergency-red.ts

# 2. Verify issuance halt
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-emergency.ts

# 3. Monitor emergency status
yarn hardhat run scripts/issuance/monitor-emergency.ts

# 4. Reset emergency level when safe
CONFIG_ADDRESS=0x... yarn hardhat run scripts/issuance/reset-emergency.ts
```

#### Cap Adjust on Triggers
```bash
# 1. Monitor trigger conditions
yarn hardhat run scripts/issuance/monitor-triggers.ts

# 2. Check current cap and detachment
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-state.ts

# 3. Execute trigger adjustments
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/adjust-triggers.ts --defaults 600 --sovereign 2500 --correlation 7000

# 4. Verify adjustments
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/check-state.ts

# 5. Ratify if needed
CONTROLLER_ADDRESS=0x... yarn hardhat run scripts/issuance/ratify-detachment.ts
```

### Monitoring and Alerts

#### Key Metrics
- **Cap Utilization**: Current supply vs super senior cap
- **Detachment Level**: Current detachment BPS
- **Ratification Status**: Pending ratification windows
- **Emergency Level**: Current emergency state
- **Trigger Conditions**: Defaults, sovereign usage, correlation

#### Alert Thresholds
- **Cap Utilization > 90%**: High utilization warning
- **Detachment > 105%**: Elevated risk warning
- **Ratification Window < 6h**: Urgent ratification needed
- **Emergency Level = 2**: RED emergency active
- **Trigger Fired**: Risk adjustment executed

#### Monitoring Commands
```bash
# Continuous monitoring
yarn hardhat run scripts/issuance/monitor-continuous.ts

# Daily health check
yarn hardhat run scripts/issuance/health-check.ts

# Weekly risk assessment
yarn hardhat run scripts/issuance/risk-assessment.ts
```

### Configuration Parameters

#### ConfigRegistry Keys
- `keccak256("emergency.level")` → Emergency level (0=GREEN, 1=AMBER, 2=RED)
- `keccak256("issuance.detach.cooldownSec")` → Detachment cooldown period (default: 7 days)

#### Default Values
- **Initial Cap**: 1,000,000 BRICS (1e24)
- **Initial Detachment**: 101.00% (10100 bps)
- **Ratification Window**: 24 hours
- **Cooldown Period**: 7 days
- **Trigger Thresholds**:
  - Sovereign Usage: 20% (2000 bps)
  - Defaults: 5% (500 bps)
  - Correlation: 65% (6500 bps)

### Oracle Operations

#### Check Oracle Status
```bash
# Check current oracle state
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts

# Expected output:
# === Current Oracle State ===
# Latest NAV: 1.050000000000000000
# Last Update TS: 1640995200
# Is Emergency: false
# Model Hash: 0x1234567890abcdef...
# Signers: [0x..., 0x..., 0x...]
# Quorum: 2
```

#### Emergency NAV Operations
```bash
# Enable emergency NAV
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --emergency-enable 0.95

# Disable emergency NAV
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --emergency-disable

# Check emergency status
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --check-emergency
```

#### Signer Management
```bash
# Rotate signers
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --rotate-signers 0x...,0x...,0x...

# Update quorum
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --update-quorum 3

# Check signer status
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --check-signers
```

#### Model Hash Management
```bash
# Roll model hash
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --roll-model-hash 0x...

# Check current model hash
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --check-model-hash
```

#### NAV Submission
```bash
# Submit NAV with signatures (requires off-chain signature generation)
ORACLE_ADDRESS=0x... yarn hardhat run scripts/oracle/ops.ts --submit-nav 1.05 signature1,signature2

# Generate signature template (for off-chain use)
yarn hardhat run scripts/oracle/ops.ts --generate-signature-template
```

### Oracle SLOs and Monitoring

#### Service Level Objectives
- **oracle.maxAgeSec**: Maximum age of NAV submissions (default: 3600s)
- **oracle.degradeAfterSec**: Auto-degradation threshold (default: 7200s)
- **oracle.minQuorum**: Minimum quorum requirement (default: 1)

#### Monitoring Commands
```bash
# Check oracle freshness
yarn hardhat run scripts/monitor.ts --oracle-freshness

# Check quorum health
yarn hardhat run scripts/monitor.ts --quorum-health

# Check emergency status
yarn hardhat run scripts/monitor.ts --emergency-status

# Auto-degradation check
yarn hardhat run scripts/monitor.ts --auto-degrade-check
```

### Check Oracle Health
```bash
# Check NAV oracle status
yarn hardhat run scripts/checkOracle.ts

# Expected output:
# NAV: 1.000000000000000000
# Last update: 1640995200
# Degradation level: NORMAL
# Signer count: 3/3
# Quorum met: true
```

### Rotate Oracle Signers
```bash
# Add new signer
yarn hardhat run scripts/oracleSigner.ts --action add --address 0x1234567890abcdef...

# Remove signer
yarn hardhat run scripts/oracleSigner.ts --action remove --address 0x1234567890abcdef...

# Update quorum
yarn hardhat run scripts/oracleSigner.ts --action quorum --threshold 2
```

### Oracle Degradation Recovery
```bash
# Check degradation status
yarn hardhat run scripts/oracleDegradation.ts --action status

# Initiate recovery
yarn hardhat run scripts/oracleDegradation.ts --action recover

# Emergency override (requires super emergency role)
yarn hardhat run scripts/oracleDegradation.ts --action override --nav 1.000000000000000000
```

## Buffer Management

### Check Buffer Health
```bash
# Check Pre-Tranche Buffer
yarn hardhat run scripts/checkBuffer.ts --buffer pre-tranche

# Check IRB Buffer
yarn hardhat run scripts/checkBuffer.ts --buffer irb

# Check all buffers
yarn hardhat run scripts/checkBuffer.ts --buffer all
```

### Fund Buffer
```bash
# Fund Pre-Tranche Buffer
yarn hardhat run scripts/fundBuffer.ts --buffer pre-tranche --amount 10000000000000

# Fund IRB Buffer
yarn hardhat run scripts/fundBuffer.ts --buffer irb --amount 3000000000000
```

### Emergency Buffer Operations
```bash
# Emergency withdraw (requires GOV_ROLE)
yarn hardhat run scripts/emergencyWithdraw.ts --buffer pre-tranche --amount 5000000000000

# Sync buffer targets
yarn hardhat run scripts/syncBuffer.ts
```

## Gateway Operations

### Check Gateway Status
```bash
# Check gateway health
yarn hardhat run scripts/gatewayStatus.ts

# Expected output:
# Gateway: ACTIVE
# Daily instant cap: 50000000000
# Current day: 19000
# Paused: false
```

### Gateway Pause/Unpause
```bash
# Pause gateway (emergency only)
yarn hardhat run scripts/gatewayPause.ts --action pause --reason "emergency_maintenance"

# Unpause gateway
yarn hardhat run scripts/gatewayPause.ts --action unpause
```

### Process Month-End Strike
```bash
# Process strike for current month
yarn hardhat run scripts/processStrike.ts

# Process strike for specific timestamp
yarn hardhat run scripts/processStrike.ts --timestamp 1640995200
```

## Member Management

### Add Member
```bash
# Add new member
yarn hardhat run scripts/memberManagement.ts --action add --address 0x1234567890abcdef...

# Add whitelisted pool
yarn hardhat run scripts/memberManagement.ts --action add-pool --address 0x1234567890abcdef...
```

### Remove Member
```bash
# Remove member
yarn hardhat run scripts/memberManagement.ts --action remove --address 0x1234567890abcdef...

# Remove whitelisted pool
yarn hardhat run scripts/memberManagement.ts --action remove-pool --address 0x1234567890abcdef...
```

### Check Member Status
```bash
# Check member status
yarn hardhat run scripts/memberManagement.ts --action status --address 0x1234567890abcdef...
```

## Configuration Management

### Update Config Parameters
```bash
# Update AMM slippage bounds
yarn hardhat run scripts/configUpdate.ts --param amm-slippage --value 1500

# Update redeem cap
yarn hardhat run scripts/configUpdate.ts --param redeem-cap --value 2500

# Update emergency level
yarn hardhat run scripts/configUpdate.ts --param emergency-level --value 1
```

### Check Configuration
```bash
# Check all config parameters
yarn hardhat run scripts/configCheck.ts

# Expected output:
# Emergency level: NORMAL
# AMM slippage: 500 bps
# Redeem cap: 2500 bps
# IRB target: 3%
```

## Sovereign Operations

### Sovereign Claim Management
```bash
# Check sovereign claim status
yarn hardhat run scripts/sovereignClaim.ts --action status --claim-id 123

# Trigger sovereign claim
yarn hardhat run scripts/sovereignClaim.ts --action trigger --reason "junior_exhaustion"

# Process sovereign claim
yarn hardhat run scripts/sovereignClaim.ts --action process --claim-id 123
```

### Sovereign Configuration
```bash
# Add sovereign configuration
yarn hardhat run scripts/sovereignConfig.ts --action add --sovereign "ZA" --cap 5000 --haircut 1000

# Update sovereign configuration
yarn hardhat run scripts/sovereignConfig.ts --action update --sovereign "ZA" --cap 6000

# Check sovereign utilization
yarn hardhat run scripts/sovereignConfig.ts --action utilization --sovereign "ZA"
```

## Risk Management

### Check Risk Metrics
```bash
# Check tail correlation
yarn hardhat run scripts/riskMetrics.ts --metric tail-correlation

# Check sovereign utilization
yarn hardhat run scripts/riskMetrics.ts --metric sovereign-utilization

# Check buffer health
yarn hardhat run scripts/riskMetrics.ts --metric buffer-health
```

### Risk Assessment
```bash
# Run risk assessment
yarn hardhat run scripts/riskAssessment.ts

# Expected output:
# Risk level: LOW
# Tail correlation: 0.15
# Sovereign utilization: 0.45
# Buffer health: 0.85
# Recommendations: None
```

## Monitoring and Alerts

### System Health Check
```bash
# Comprehensive health check
yarn hardhat run scripts/healthCheck.ts

# Expected output:
# Oracle: HEALTHY
# Buffers: HEALTHY
# Gateway: ACTIVE
# Emergency level: NORMAL
# Overall status: HEALTHY
```

### Alert Configuration
```bash
# Set up emergency alerts
yarn hardhat run scripts/alerts.ts --action setup --level YELLOW

# Test alert system
yarn hardhat run scripts/alerts.ts --action test
```

## Emergency Procedures

### Crisis Response
```bash
# Activate crisis mode
yarn hardhat run scripts/crisisResponse.ts --action activate --level RED

# Emergency buffer deployment
yarn hardhat run scripts/crisisResponse.ts --action deploy-buffers

# Sovereign claim activation
yarn hardhat run scripts/crisisResponse.ts --action sovereign-claim
```

### Recovery Procedures
```bash
# Initiate recovery
yarn hardhat run scripts/recovery.ts --action initiate

# Restore normal operations
yarn hardhat run scripts/recovery.ts --action restore
```

## Audit and Compliance

### Audit Trail
```bash
# Generate audit report
yarn hardhat run scripts/audit.ts --action report --start 1640995200 --end 1641081600

# Export audit data
yarn hardhat run scripts/audit.ts --action export --format csv
```

### Compliance Check
```bash
# Run compliance check
yarn hardhat run scripts/compliance.ts

# Expected output:
# Basel III: COMPLIANT
# MiFID II: COMPLIANT
# PFMA: COMPLIANT
# Overall: COMPLIANT
```

## Environment Setup

### Required Environment Variables
```bash
# .env file template
BRICS_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
BRICS_PRIVATE_KEY=0x1234567890abcdef...
BRICS_CONTRACT_ADDRESSES={"gateway":"0x...","config":"0x...","oracle":"0x..."}
BRICS_API_KEY=your_api_key_here
BRICS_EMERGENCY_CONTACTS={"ops":"+1234567890","gov":"+0987654321"}
```

### Role Verification
```bash
# Check role permissions
yarn hardhat run scripts/roleCheck.ts

# Expected output:
# OPS_ROLE: true
# GOV_ROLE: false
# ECC_ROLE: false
# Current address: 0x1234567890abcdef...
```

## Troubleshooting

### Common Issues
```bash
# Check transaction status
yarn hardhat run scripts/troubleshoot.ts --action tx-status --hash 0xabcdef1234567890...

# Check contract state
yarn hardhat run scripts/troubleshoot.ts --action contract-state --contract gateway

# Reset emergency state (super emergency only)
yarn hardhat run scripts/troubleshoot.ts --action reset-emergency
```

### Log Analysis
```bash
# Analyze recent logs
yarn hardhat run scripts/logAnalysis.ts --hours 24

# Search for specific events
yarn hardhat run scripts/logAnalysis.ts --search "EmergencyLevelChanged"
```

## Risk API Operations

### Overview
The BRICS Risk API provides aggregate-only risk feeds with deterministic Ed25519 signing. This section covers operational procedures for managing the API service.

### Service Management

#### Health Checks
```bash
# Check API health
curl -f http://localhost:8000/api/v1/health

# Expected output:
# {"status":"ok","ts":1640995200}

# Check with timeout
curl --max-time 5 -f http://localhost:8000/api/v1/health
```

#### Service Status Monitoring
```bash
# Monitor all endpoints
for endpoint in health nav emergency issuance risk; do
  echo "Testing $endpoint..."
  curl -s "http://localhost:8000/api/v1/$endpoint" | jq '.ts'
done

# Check public key endpoint
curl -s http://localhost:8000/.well-known/risk-api-pubkey | jq '.ed25519_pubkey_hex'
```

### Key Management

#### Rotate Signing Key
```bash
# 1. Generate new Ed25519 key pair
openssl genpkey -algorithm ed25519 -out new_private_key.pem
openssl pkey -in new_private_key.pem -pubout -out new_public_key.pem

# 2. Convert to hex format
PRIVATE_KEY_HEX=$(openssl pkey -in new_private_key.pem -outform DER | xxd -p -c 64)
echo "RISK_API_ED25519_SK_HEX=$PRIVATE_KEY_HEX" >> .env

# 3. Restart service with new key
docker-compose restart risk-api

# 4. Verify new public key
curl -s http://localhost:8000/.well-known/risk-api-pubkey | jq '.ed25519_pubkey_hex'
```

#### Key Backup and Recovery
```bash
# Backup current key
cp .env .env.backup.$(date +%Y%m%d)

# Restore from backup
cp .env.backup.20240101 .env
docker-compose restart risk-api
```

### Configuration Management

#### Environment Variables
```bash
# Required variables
RISK_API_ED25519_SK_HEX=000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f

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
```

#### Update Configuration
```bash
# Update NAV values
export NAV_RAY=1100000000000000000000000000
export NAV_MODEL_HASH=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
docker-compose restart risk-api

# Update emergency state
export EMERGENCY_LEVEL=1
export EMERGENCY_REASON="buffer_health_degraded"
docker-compose restart risk-api
```

### Deployment

#### Docker Deployment
```bash
# Build image
docker build -t brics-risk-api:latest .

# Run container
docker run -d \
  --name brics-risk-api \
  -p 8000:8000 \
  --env-file .env \
  brics-risk-api:latest

# Check logs
docker logs -f brics-risk-api

# Stop service
docker stop brics-risk-api
docker rm brics-risk-api
```

#### Production Deployment
```bash
# Deploy with docker-compose
docker-compose up -d risk-api

# Check service health
docker-compose ps risk-api
docker-compose logs risk-api

# Scale service
docker-compose up -d --scale risk-api=3
```

### Monitoring and Alerts

#### Service Level Objectives (SLOs)
- **Availability**: 99.9% uptime
- **Latency**: < 100ms response time (95th percentile)
- **Error Rate**: < 0.1% error rate
- **Signature Verification**: 100% valid signatures

#### Health Check Script
```bash
#!/bin/bash
# health_check.sh

API_URL="http://localhost:8000"
TIMEOUT=5

# Check health endpoint
if ! curl -f --max-time $TIMEOUT "$API_URL/api/v1/health" > /dev/null 2>&1; then
    echo "ERROR: Health check failed"
    exit 1
fi

# Check signed endpoint
if ! curl -f --max-time $TIMEOUT "$API_URL/api/v1/nav/latest" > /dev/null 2>&1; then
    echo "ERROR: NAV endpoint failed"
    exit 1
fi

# Verify signature
NAV_RESPONSE=$(curl -s "$API_URL/api/v1/nav/latest")
PUBLIC_KEY=$(curl -s "$API_URL/.well-known/risk-api-pubkey" | jq -r '.ed25519_pubkey_hex')

# Extract data without signature
NAV_DATA=$(echo "$NAV_RESPONSE" | jq 'del(.sig)')
SIGNATURE=$(echo "$NAV_RESPONSE" | jq -r '.sig')

# Verify signature (requires Python script)
if ! python3 verify_signature.py "$NAV_DATA" "$SIGNATURE" "$PUBLIC_KEY"; then
    echo "ERROR: Signature verification failed"
    exit 1
fi

echo "SUCCESS: All health checks passed"
```

#### Log Monitoring
```bash
# Monitor logs for errors
docker-compose logs -f risk-api | grep -i error

# Monitor response times
docker-compose logs risk-api | grep "response_time"

# Monitor signature generation
docker-compose logs risk-api | grep "signature_generated"
```

### Troubleshooting

#### Common Issues

**Service Won't Start**
```bash
# Check environment variables
docker-compose config

# Check logs
docker-compose logs risk-api

# Verify key format
echo $RISK_API_ED25519_SK_HEX | wc -c  # Should be 65 (64 chars + newline)
```

**Invalid Signatures**
```bash
# Check public key endpoint
curl -s http://localhost:8000/.well-known/risk-api-pubkey

# Verify key pair consistency
python3 -c "
import os
from risk_api.signing import SigningKey
sk = SigningKey(os.getenv('RISK_API_ED25519_SK_HEX'))
print(f'Public key: {sk.public_key_hex()}')
"
```

**High Response Times**
```bash
# Check system resources
docker stats brics-risk-api

# Check network connectivity
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/health

# Monitor CPU and memory usage
top -p $(pgrep -f "uvicorn.*risk_api")
```

#### Recovery Procedures

**Service Restart**
```bash
# Graceful restart
docker-compose restart risk-api

# Force restart
docker-compose stop risk-api
docker-compose rm -f risk-api
docker-compose up -d risk-api
```

**Configuration Recovery**
```bash
# Restore from backup
cp .env.backup.$(date +%Y%m%d) .env
docker-compose restart risk-api

# Verify configuration
curl -s http://localhost:8000/api/v1/nav/latest | jq '.nav_ray'
```

### Security Notes

### Access Control
- All scripts require appropriate role permissions
- Emergency operations require ECC_ROLE or higher
- Super emergency operations require special authorization
- All operations are logged for audit purposes

### Best Practices
- Always verify parameters before execution
- Use dry-run mode for testing
- Keep private keys secure
- Monitor system health regularly
- Have backup procedures ready

### Emergency Contacts
- Operations: +1 (555) 123-4567
- Governance: +1 (555) 987-6543
- Emergency Committee: +1 (555) 456-7890
