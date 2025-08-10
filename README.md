## BRICS Protocol – Developer Guide

### Overview
Smart contracts and tooling for the BRICS super‑senior tranche protocol. The repo includes issuance/redemption control, tranche management, treasury/buffer, oracle, membership gating, and deployment scripts.

Key contracts:
- `IssuanceControllerV3`: governs mint/redeem flows and governance ratification windows
- `TrancheManagerV2`: detachment band, caps, emergency soft‑cap expansion window
- `PreTrancheBuffer`: instant redemption buffer (USDC)
- `Treasury`: funds custody for issuance/redemption
- `NAVOracleV3`: on‑chain NAV with quorum and dev seeding for local testing
- `MemberRegistry` + `OperationalAgreement`: membership gating and ops roles

Recent hardening highlights:
- ReentrancyGuard on critical paths (issuance/redemption/buffer)
- Custom errors replacing revert strings
- Per‑address daily issuance cap (anti‑sybil)
- Burn‑before‑external‑call in instant redemption path
- Tranche soft‑cap (105%) with 30‑day expiry and governance attestation
- Buffer accounting based on `balanceOf` to avoid drift
- Local‑only `devSeedNAV` to bootstrap NAV in development

---

## Requirements
- Node.js 20.x (project uses `.nvmrc` → 20.19.4)
- npm 10+

Optional:
- A running local Hardhat node (for multi‑script deploys)

---

## Quick Start
```bash
nvm use           # picks up .nvmrc (20.19.4)
npm ci            # install deps
npm run build     # compile + typechain
npm run test      # run unit tests
```

If you see a Node 23 warning, ensure you are on Node 20.

---

## Local Development
### Start a persistent node
```bash
npx hardhat node --hostname 127.0.0.1
```

### Deploy to localhost (in another terminal)
The deployment writes addresses to `deployments-localhost.json`.
```bash
npx hardhat run --network localhost deploy/00_env.ts && \
npx hardhat run --network localhost deploy/01_core.ts && \
npx hardhat run --network localhost deploy/02_finance.ts && \
npx hardhat run --network localhost deploy/04_oracle.ts && \
npx hardhat run --network localhost deploy/03_tranche.ts && \
npx hardhat run --network localhost deploy/05_issuance_and_claims.ts && \
npx hardhat run --network localhost deploy/90_roles_and_params.ts && \
npx hardhat run --network localhost deploy/99_report.ts
```

Oracle deploy seeds a dev NAV on localhost/hardhat via `devSeedNAV`.

### Smoke: mint BRICS
```bash
npx hardhat run --network localhost scripts/smokeMint.ts
```

---

## Networks and .env
Create a `.env` file for testnets (example for Sepolia):
```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
PRIVATE_KEY=0xabc...        # deployer
ETHERSCAN_API_KEY=<key>

# Optional multisigs/addresses
DAO_MULTISIG=0x...
ECC_MULTISIG=0x...
SPV_OPS_MULTISIG=0x...
TREASURY_OPS_MULTISIG=0x...
USDC_ADDRESS=0xMockOrRealUSDCOnNetwork

# Oracle model + signers (optional)
MODEL_HASH=0x...
MODEL_SIGNER_1=0x...
MODEL_SIGNER_2=0x...
MODEL_SIGNER_3=0x...
EMERGENCY_SIGNER_NASASA=0x...
EMERGENCY_SIGNER_OLDMUTUAL=0x...
```

### Deploy to Sepolia
```bash
npm run deploy:sepolia
# optional
npm run verify:all
```

---

## NPM Scripts
- `build`: Hardhat compile + TypeChain
- `test`: Hardhat tests
- `deploy:dev`: runs all deploy scripts on the in‑memory Hardhat network
- `deploy:sepolia`: runs all deploy scripts on Sepolia
- `verify:all`: verification helper
- `lint:sol`: Solhint over `contracts/**/*.sol`
- `lint:ts`: ESLint 9 – requires an `eslint.config.js` (see notes)

---

## Tasks (operational helpers)
Examples (use `--network localhost` or `sepolia`):
```bash
# Approve a member
npx hardhat member:approve --user 0xabc...

# Confirm sovereign guarantee (affects 105% soft-cap in RED)
npx hardhat sovereign:confirm --confirmed true

# Raise detachment
npx hardhat tranche:raise --lo 10100 --hi 10300

# Set emergency level (0 NORMAL, 1 YELLOW, 2 ORANGE, 3 RED)
npx hardhat set:level --level 3 --reason "stress"

# Toggle oracle degradation mode
npx hardhat oracle:degradation --enabled true
```

---

## Contract Notes
- `IssuanceControllerV3`
  - `mintFor` is `onlyRole(OPS_ROLE)`, non‑reentrant, rate‑limited per address/day, and checks emergency params and caps.
  - Instant redeem path burns before interacting with `PreTrancheBuffer` and emits `InstantRedeemProcessed`.
  - Governance ratification and optional extension windows are enforced via timestamps.

- `TrancheManagerV2`
  - Enforces only‑raise invariant and oracle freshness (unless in degradation mode).
  - ECC can expand to 105% in RED if sovereign confirmed and governance attested; expires within 30 days and can be enforced to revert.

- `PreTrancheBuffer`
  - Uses USDC `balanceOf` for accounting; reentrancy‑guarded; daily per‑member cap throttled in ORANGE/RED.

- `NAVOracleV3`
  - Quorum‑based updates; local‑only `devSeedNAV` used during localhost deploys.

- `OperationalAgreement`
  - Ops roles and member/pool management; registrar binding is handled in deploy scripts.

---

## Linting & Coverage
- Solidity: `npm run lint:sol`
  - Notes: Several warnings (e.g., `no-global-import`, `gas-custom-errors`) are intentionally pending.
- TypeScript: ESLint v9 requires a flat config (`eslint.config.js`). Either add one or pin ESLint to v8.
- Coverage (optional):
```bash
npx hardhat coverage
```

---

## Troubleshooting
- Hardhat + Node 23: not supported. Use Node 20 (`nvm use`).
- NAV = 0 locally: ensure `deploy/04_oracle.ts` ran on localhost; it seeds NAV via `devSeedNAV`.
- Registrar errors: ensure `MemberRegistry.setRegistrar(OperationalAgreement)` has been called (handled in deploy flow).

---

## Repository Layout
- `contracts/`: Solidity sources
- `deploy/`: sequenced deploy scripts writing `deployments-<network>.json`
- `scripts/`: smoke scripts and utilities
- `tasks/`: Hardhat task entry points
- `test/`: unit tests
- `offchain/`, `python-backend/`: ancillary off‑chain code

---

## License
MIT

---

## Post‑Deployment Operations & Integration Roadmap

- Frontend + Wallet Integration
  - Build a minimal React/Next UI (or Webflow embed) to display NAV, tranche cap, and buffer health.
  - Connect wallet (ethers/viem) and wire mint/redeem to `IssuanceControllerV3`.
  - Show redemption status (instant vs queued) using events and `pending` mapping.

- Off‑chain AI + Oracle Wiring
  - Stand up signer service for XGBoost risk engine and market feeds (CDS, rates).
  - Produce quorum signatures and call `NAVOracleV3.setNAV` on schedule; monitor staleness.
  - Use `degradationMode` during outages; emergency signer flow for `emergencySetNAV`.

- Governance + DAO Hooks
  - Define multisigs and role grants (DAO, ECC, SPV) in env.
  - Add tasks for `attestSupermajority`, parameter updates, and expiry enforcement.
  - Optional timelock for sensitive parameter changes (mainnet).

- Mainnet Readiness
  - Dry‑run on Sepolia with realistic params; publish addresses.
  - Timelocks, guardian procedures, and initial liquidity provisioning (treasury/buffer).
  - Final go/no‑go checklist and post‑launch monitoring.

- Monitoring & Alerting
  - Run `scripts/monitor.ts` as a daemon; send alerts on emergency level and soft‑cap windows.
  - Off‑chain health checks for oracle signer quorum and NAV staleness.

- Audit & Legal Handoff
  - Assemble audit pack (spec, threat model, invariants, diagrams) and deliver to auditors.
  - Link offering memorandum / legal docs for investor due diligence.

---

## Code Examples (ethers.js)

Mint BRICS (OPS):
```ts
const controller = await ethers.getContractAt("IssuanceControllerV3", addr);
await usdc.approve(controller, amountUSDC);
const tx = await controller.mintFor(user, amountUSDC, 0, 0);
await tx.wait();
```

Request redeem (instant path if available):
```ts
const tx = await controller.requestRedeemOnBehalf(user, amount);
await tx.wait();
```

Set emergency level (ECC/GOV):
```ts
const cfg = await ethers.getContractAt("ConfigRegistry", cfgAddr);
await (cfg as any).setEmergencyLevel(3, "stress");
```

Confirm sovereign guarantee and expand to soft‑cap (GOV/ECC):
```ts
const tm = await ethers.getContractAt("TrancheManagerV2", tmAddr);
await (tm as any).confirmSovereignGuarantee(true);
await (tm as any).attestSupermajority(7000);
await (tm as any).emergencyExpandToSoftCap();
```

Oracle update (dev/local):
```bash
NAV_RAY=1 npx hardhat run --network localhost scripts/oracleUpdate.ts
```
