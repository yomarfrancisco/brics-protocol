# BRICS Protocol - Role Permission Matrix

## Overview
This document defines the canonical role permissions for the BRICS Protocol. The `roles:audit` task uses this matrix to verify on-chain role configurations.

## Core Roles

### Governance Roles
- **GOV_ROLE**: Ultimate governance authority
  - Can pause/unpause the system
  - Can set emergency levels
  - Can configure sovereign parameters
  - Can adjust caps and thresholds

- **OPS_ROLE**: Operational authority
  - Can mint BRICS tokens
  - Can open/close NAV windows
  - Can process redemption requests
  - Can strike NAV for settlement

- **ECC_ROLE**: Emergency Control Committee
  - Can set emergency levels
  - Can force oracle recovery
  - Can manage sovereign guarantee claims

### Functional Roles
- **MINTER_ROLE**: Can mint BRICS tokens
  - Granted to: IssuanceController

- **BURNER_ROLE**: Can burn BRICS tokens
  - Granted to: IssuanceController (for redemptions)

- **ISSUER_ROLE**: Can issue redemption claims
  - Granted to: IssuanceController

- **PAY_ROLE**: Can withdraw from Treasury
  - Granted to: IssuanceController

- **BUFFER_MANAGER**: Can manage PreTrancheBuffer
  - Granted to: IssuanceController

### Specialized Roles
- **BURNER_ROLE** (RedemptionClaim): Can burn redemption claims
  - Granted to: Burner Safe (for settlement)

- **BURNER_ROLE** (IssuanceController): Can burn BRICS during settlement
  - Granted to: Burner Safe

## Role Assignments

| Contract | Role | Grantee | Purpose |
|----------|------|---------|---------|
| BRICSToken | MINTER_ROLE | IssuanceController | Mint new BRICS tokens |
| BRICSToken | BURNER_ROLE | IssuanceController | Burn BRICS for redemptions |
| RedemptionClaim | ISSUER_ROLE | IssuanceController | Issue redemption claims |
| RedemptionClaim | BURNER_ROLE | Burner Safe | Burn claims during settlement |
| IssuanceController | OPS_ROLE | Ops Multisig | Operational functions |
| IssuanceController | BURNER_ROLE | Burner Safe | Settlement functions |
| PreTrancheBuffer | BUFFER_MANAGER | IssuanceController | Buffer management |
| Treasury | PAY_ROLE | IssuanceController | Withdraw funds |
| ClaimRegistry | ECC_ROLE | ECC Authority | Emergency control |
| TrancheManager | ECC_ROLE | ECC Authority | Emergency control |
| MemberRegistry | registrar | NASASA Entity | Member management |

## Security Considerations

1. **Separation of Concerns**: OPS_ROLE and GOV_ROLE are separate to limit operational risk
2. **Emergency Control**: ECC_ROLE provides emergency override capabilities
3. **Settlement Security**: Burner Safe controls final settlement to prevent unauthorized burns
4. **Member Management**: NASASA Entity controls member registration independently

## Audit Commands

```bash
# Deploy and verify roles
npx hardhat deploy:core --params deployment/mainnet.params.json --network mainnet
npx hardhat roles:wire --params deployment/mainnet.params.json --addresses deployment/mainnet.addresses.json --network mainnet
npx hardhat roles:audit --params deployment/mainnet.params.json --addresses deployment/mainnet.addresses.json --network mainnet
```
