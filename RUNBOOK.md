# BRICS Protocol – Ops Runbook (Mainnet)

## Roles
- **GOV_SAFE**: Ultimate admin; runs config, caps, emergency level
- **OPS_SAFE**: Daily issuance ops; opens/closes/redemption flows
- **ECC_SAFE**: Emergency changes (oracle degrade, pause)
- **BURNER_SAFE**: Settlement burner authority (claims burn)
- **NASASA_ENTITY**: Registrar for MemberRegistry

## Daily Issuance Flow

### 1) Health Check
```bash
# Check canIssue for ZA/BR with small amount
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
const canIssue = await ic.canIssue(ethers.parseUnits("1000", 6), 0, 0, ethers.encodeBytes32String("ZA"));
console.log("Can issue ZA:", canIssue);
EOF

# Check oracle degradation = NORMAL (haircut 0)
npx hardhat console --network mainnet <<'EOF'
const oracle = await ethers.getContractAt("NAVOracleV3", "<ORACLE_ADDR>");
const degradation = await oracle.getDegradationLevel();
console.log("Oracle degradation level:", degradation);
EOF

# Check buffers healthy
npx hardhat console --network mainnet <<'EOF'
const pre = await ethers.getContractAt("PreTrancheBuffer", "<PRE_ADDR>");
const tre = await ethers.getContractAt("Treasury", "<TRE_ADDR>");
const bufferStatus = await pre.getBufferStatus();
const treasuryStatus = await tre.getLiquidityStatus();
console.log("Buffer capacity:", bufferStatus.availableInstantCapacity);
console.log("Treasury liquidity:", treasuryStatus.totalLiquidity);
EOF
```

### 2) NAV Window Operations
```bash
# Open NAV window (+3 days)
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
const now = (await ethers.provider.getBlock('latest')).timestamp;
await ic.openNavWindow(now + 3*24*3600);
EOF

# During window: queue redemption requests
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
await ic.requestRedeemOnBehalf("<USER_ADDR>", ethers.parseUnits("1000", 6));
EOF
```

### 3) Close & Strike
```bash
# After closeTs: close window
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
await ic.closeNavWindow();
EOF

# Strike NAV
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
await ic.strikeRedemption();
EOF
```

### 4) Settlement (T+5d)
```bash
# Settle claims (partial → emits NAVCarryoverCreated)
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
await ic.settleClaim(1, 1, "<HOLDER_ADDR>");
EOF
```

## Emergency Playbook

### Oracle Failure
```bash
# ECC sets haircut or emergencySetNAV()
npx hardhat console --network mainnet <<'EOF'
const oracle = await ethers.getContractAt("NAVOracleV3", "<ORACLE_ADDR>");
await oracle.emergencySetNAV(ethers.parseEther("1.0"));
EOF

# GOV pauses issuance
npx hardhat console --network mainnet <<'EOF'
const cfg = await ethers.getContractAt("ConfigRegistry", "<CFG_ADDR>");
await cfg.setEmergencyLevel(2, "oracle_failure");
EOF
```

### Buffer Stress
```bash
# OPS triggers funding cascade
npx hardhat console --network mainnet <<'EOF'
const pre = await ethers.getContractAt("PreTrancheBuffer", "<PRE_ADDR>");
await pre.fundBuffer(ethers.parseUnits("1000000", 6));
EOF

# If < threshold → auto-pause
npx hardhat console --network mainnet <<'EOF'
const cfg = await ethers.getContractAt("ConfigRegistry", "<CFG_ADDR>");
await cfg.setEmergencyLevel(1, "buffer_stress");
EOF
```

### Sovereign Trigger
```bash
# ClaimRegistry: 48h trigger → 7d notice → 90d execute
npx hardhat console --network mainnet <<'EOF'
const reg = await ethers.getContractAt("ClaimRegistry", "<REG_ADDR>");
await reg.triggerClaim(ethers.encodeBytes32String("ZA"), "sovereign_default");
EOF
```

## Monitoring & Alerts

### Key Events to Monitor
- `EmergencyLevelSet`
- `NAVWindowOpened` / `NAVWindowClosed`
- `NAVStruck`
- `NAVSettled`
- `NAVCarryoverCreated`
- `SovereignUtilizationUpdated`
- `RoleGranted` / `RoleRevoked`

### Alert Conditions
- `haircut > 0` → Oracle degradation
- `buffer < threshold` → Liquidity stress
- `issuanceLocked = true` → Emergency pause
- `emergencyLevel >= ORANGE` → Crisis mode

### Invariant Checks
```bash
# Run invariant tests
npm run test -- --grep "Invariants"

# Check capital stack
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
const tm = await ethers.getContractAt("TrancheManagerV2", "<TM_ADDR>");
const token = await ethers.getContractAt("BRICSToken", "<TOKEN_ADDR>");

const totalSupply = await token.totalSupply();
const reserved = await ic.reservedForNav();
const totalIssued = await ic.totalIssued();
const cap = await tm.superSeniorCap();

console.log("Total supply:", totalSupply);
console.log("Reserved for NAV:", reserved);
console.log("Total issued:", totalIssued);
console.log("Super senior cap:", cap);
console.log("Invariant check:", totalIssued + reserved === totalSupply);
EOF
```

## Deployment Commands

### Full Deployment
```bash
# Deploy and verify
./scripts/deploy-check.sh mainnet

# Individual steps
npx hardhat deploy:core --params deployment/mainnet.params.json --network mainnet
npx hardhat roles:wire --params deployment/mainnet.params.json --addresses deployment/mainnet.addresses.json --network mainnet
npx hardhat roles:audit --addresses deployment/mainnet.addresses.json --network mainnet
```

### Smoke Test
```bash
# Test small issuance
npx hardhat console --network mainnet <<'EOF'
const ic = await ethers.getContractAt("IssuanceControllerV3", "<IC_ADDR>");
const canIssue = await ic.canIssue(ethers.parseUnits("1", 6), 0, 0, ethers.encodeBytes32String("ZA"));
console.log("Can issue 1 USDC:", canIssue);
EOF
```

## Emergency Contacts

- **GOV_SAFE**: Governance decisions
- **ECC_SAFE**: Emergency control committee
- **OPS_SAFE**: Daily operations
- **BURNER_SAFE**: Settlement authority

## Circuit Breaker

If any of these conditions are met:
1. Oracle degradation level > 1
2. Buffer capacity < 10% of target
3. Emergency level >= ORANGE
4. NAV window stuck open > 7 days

**IMMEDIATE ACTION**: Set emergency level to RED and pause all operations.

```bash
npx hardhat console --network mainnet <<'EOF'
const cfg = await ethers.getContractAt("ConfigRegistry", "<CFG_ADDR>");
await cfg.setEmergencyLevel(3, "circuit_breaker");
EOF
```
