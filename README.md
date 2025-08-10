# BRICS Protocol: Institution-Grade Synthetic Risk Transfer for Emerging Markets

## What It Is
BRICS is a sovereign-backed, AI-governed, member-gated DeFi protocol that unlocks capital efficiency for emerging market bank loan portfolios. It transforms $2.3 trillion in performing loans into liquid, AAA-grade synthetic assets through multi-sovereign risk transfer mechanics and dynamic issuance controls.

## What It Does
The protocol mints BRICS tokens — super-senior tranche instruments (100–102% normal, expandable to 105–108% in crisis) that function like stablecoins but survive like AAA bonds. Risk is synthetically transferred via CDS from banks to institutional and on-chain investors, with 90%+ coverage from a multi-sovereign guarantee layer. AI-driven issuance throttles or halts when tail correlation, sovereign utilisation, or buffer health breach limits.

## Core Liquidity & Risk Structure
- **Bank Equity (0–5%)**: First-loss protection
- **Mezzanine (5–10%)**: ERC-4626 vault with 5-year reinvestment from underwriters (e.g., Old Mutual, NASASA)
- **Sovereign Guarantee (10–100%)**: Diversified across BRICS nations for cross-sovereign hedging; legally enforceable under PFMA/ISDA frameworks with 7-day notice, 90-day execution
- **Pre-Tranche Buffer ($10M)**: Instant redemptions (daily limits)
- **Instant Redemption Buffer (3–12%)**: AMM liquidity scaling with emergency level
- **BRICS Super-Senior (100–108%)**: Detachment expansion in RED state with sovereign confirmation

## Value Proposition
- **For Banks**: Unlock 20–30% capital efficiency without selling assets
- **For Investors**: Access emerging market credit with sovereign backing, crisis protection, and predictable exit paths (instant, monthly, or sovereign-bridge redemptions)
- **For Sovereigns**: Monetise credit capacity through structured risk transfer to both domestic and global investors
- **For the System**: Create liquid markets for previously illiquid emerging market assets, with Basel-aligned capital controls and AI-monitored systemic risk

**Result**: BRICS runs like a stablecoin but survives like a AAA bond — an adaptive sovereign credit infrastructure capable of scaling across multiple nations, dynamically hedging sovereign exposures, and enabling the largest capital efficiency transformation in emerging market banking history.

---

## Quick Start

### Requirements
- Node.js 20.x
- npm 10+
- Hardhat 2.19.0+

### Installation
```bash
npm ci
npm run build
```

### Local Development
```bash
npm run node
npm run deploy:local
npm test
```

## Key Contracts

### Core Protocol
- **IssuanceControllerV3**: Mint/redeem logic with emergency controls and per-sovereign soft-cap damping
- **TrancheManagerV2**: Detachment band management (100-108%) with sovereign guarantee integration
- **NAVOracleV3**: On-chain NAV with quorum and degradation modes
- **ConfigRegistry**: Global risk parameters and emergency level system
- **ClaimRegistry**: Sovereign guarantee claim tracking and legal milestone management

### Risk Management
- **PreTrancheBuffer**: Instant redemption liquidity buffer
- **BRICSToken**: ERC-20 token with transfer restrictions and membership gating
- **MemberRegistry**: Membership gating and pool whitelisting
- **MezzanineVault**: ERC-4626 vault for institutional investors
- **Treasury**: Central treasury with buffer management

### Emergency System
- **SovereignClaimToken**: Sovereign guarantee claim representation
- **RedemptionClaim**: Monthly redemption queue management
- **OperationalAgreement**: Legal framework integration

## Emergency Levels
- **NORMAL (0)**: Standard operations, 100-102% detachment
- **YELLOW (1)**: Elevated risk, reduced issuance rates
- **ORANGE (2)**: High risk, issuance throttling, extended cooldowns
- **RED (3)**: Crisis mode, issuance halted, sovereign guarantee activation

## Sovereign Guarantee Integration
The protocol features a sophisticated sovereign guarantee system with:
- **Legal Framework**: PFMA authority, ISDA-style terms, 7-day notice, 90-day execution
- **Multi-Sovereign Support**: Cross-sovereign hedging across BRICS nations
- **Crisis Expansion**: Dynamic detachment expansion (105-108%) with sovereign confirmation
- **Claim Lifecycle**: Complete legal milestone tracking with audit trails

## Development Workflow

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "Sovereign Guarantee"
npm test -- --grep "Per-Sovereign Soft-Cap Damping"
npm test -- --grep "Emergency System"
```

### Deployment
```bash
# Local deployment
npm run deploy:local

# Sepolia testnet
npm run deploy:sepolia

# Mainnet (requires environment setup)
npm run deploy:mainnet
```

### Governance Tasks
```bash
# Set emergency level
npx hardhat setEmergencyLevel --level 2 --reason "market stress"

# Expand to crisis mode
npx hardhat emergencyExpandSoftCap --reason "sovereign guarantee activated"

# Trigger sovereign claim
npx hardhat confirmSovereign --confirmed true --reason "crisis response"
```

## Documentation
- **[BRICS Protocol Core Specification](docs/BRICS_SPEC_CORE.md)**: Complete technical specification
- **[Sovereign Guarantee Implementation](docs/SOVEREIGN_GUARANTEE_IMPLEMENTATION.md)**: Legal framework and crisis management
- **[Repository Map](docs/REPO_MAP.md)**: Contract responsibilities and architecture
- **[Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)**: Development timeline and priorities
- **[Context Guide](docs/CONTEXT_GUIDE.md)**: Developer quick reference

## Architecture Overview

### Capital Stack
```
┌─────────────────────────────────────────────────────────────┐
│                    BRICS Super-Senior                      │
│                    (100-108% detachment)                   │
├─────────────────────────────────────────────────────────────┤
│                 Instant Redemption Buffer                  │
│                    (3-12% scaling)                         │
├─────────────────────────────────────────────────────────────┤
│                  Pre-Tranche Buffer                        │
│                      ($10M liquid)                         │
├─────────────────────────────────────────────────────────────┤
│                Sovereign Guarantee Layer                   │
│                (10-100%, multi-sovereign)                  │
├─────────────────────────────────────────────────────────────┤
│                   Mezzanine Tranche                        │
│              (5-10%, ERC-4626 vault)                       │
├─────────────────────────────────────────────────────────────┤
│                    Bank Equity                             │
│                    (0-5% first loss)                       │
└─────────────────────────────────────────────────────────────┘
```

### Emergency Response System
```
Normal Operations (100-102%)
    ↓
Market Stress → YELLOW (reduced issuance)
    ↓
Credit Deterioration → ORANGE (throttling)
    ↓
Crisis Event → RED (sovereign guarantee activation)
    ↓
Sovereign Confirmation → 105% expansion
    ↓
Legal Milestones → 106-108% expansion
```

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License
MIT License - see [LICENSE](LICENSE) for details.
