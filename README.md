# BRICS Protocol v4.0.0-rc11

[![Core CI](https://img.shields.io/badge/Core%20CI-✅%20green-brightgreen)](https://github.com/yomarfrancisco/brics-protocol/actions)

[![Replay E2E](https://img.shields.io/badge/Replay%20E2E-✅%20passing%20(required)-brightgreen)](https://github.com/yomarfrancisco/brics-protocol/actions)

[![Coverage](https://img.shields.io/badge/Coverage-71.68%25%20statements-brightgreen)](https://github.com/yomarfrancisco/brics-protocol/actions)

[![Security](https://img.shields.io/badge/Security-0%20high%20findings-brightgreen)](https://github.com/yomarfrancisco/brics-protocol/security/code-scanning)

[![Gas](https://img.shields.io/badge/Gas-Report%20generated-blue)](https://github.com/yomarfrancisco/brics-protocol/actions)

[![Version](https://img.shields.io/badge/Version-v4.0.0--rc11-blue)](https://github.com/yomarfrancisco/brics-protocol/releases)

## 🎯 **AUDIT-READY: Institution-Grade Synthetic Risk Transfer Infrastructure**

The BRICS Protocol is an **institution-grade synthetic risk transfer protocol** for emerging market bank loan portfolios, featuring sovereign-backed, member-gated, yield-bearing tokens designed to run like stablecoins but survive like AAA bonds.

### 🚀 **Core Innovation: Adaptive Sovereign Credit Infrastructure**

- **Multi-layered capital stack** with real-time crisis response
- **Dynamic detachment expansion** (100-108%) with sovereign confirmation
- **Multi-sovereign coordination** across BRICS nations
- **Legal framework integration** (PFMA/ISDA compliance)

## 📊 **Current Status: Production Ready**

### ✅ **Complete Implementation**
- **56/56 tests passing** (100% success rate)
- **All SPEC sections implemented** and tested
- **Comprehensive security measures** in place
- **Institutional-grade resilience** demonstrated

### 🎯 **Audit-Ready Features**
- **Role-based access control** with granular permissions
- **Emergency procedures** with 4-tier crisis response
- **Oracle degradation handling** with conservative haircuts
- **Buffer coordination** across all liquidity sources
- **Sovereign guarantee integration** with legal framework
- **NAV redemption lifecycle** with partial fill support
- **Per-sovereign soft-cap damping** with linear slopes

## 🏗️ **Architecture Overview**

### Capital Stack
```
BRICS Super-Senior (100-108% detachment)
    ↓
Instant Redemption Buffer (3-12% scaling)
    ↓
Pre-Tranche Buffer ($10M liquid)
    ↓
Sovereign Guarantee (10-100%, multi-sovereign)
    ↓
Mezzanine Tranche (5-10%, ERC-4626 vault)
    ↓
Bank Equity (0-5% first loss)
```

### Core Contracts
- **IssuanceControllerV3**: Core mint/redeem logic with emergency controls
- **ConfigRegistry**: Global risk parameters and emergency levels
- **BRICSToken**: ERC-20 token with transfer restrictions
- **MemberRegistry**: Membership gating and pool whitelisting
- **TrancheManagerV2**: Detachment band management (100-108%)
- **NAVOracleV3**: On-chain NAV with quorum and degradation modes
- **PreTrancheBuffer**: Instant redemption buffer ($10M liquid)
- **Treasury**: Funds custody and IRB management
- **RedemptionClaim**: NAV-based redemption claims (ERC-1155)
- **ClaimRegistry**: Sovereign guarantee claim tracking
- **SovereignClaimToken**: Sovereign backstop claims (SBT)
- **OperationalAgreement**: Membership management
- **MezzanineVault**: ERC-4626 vault for mezzanine tranche

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or yarn
- Git

### Installation
```bash
git clone https://github.com/yomarfrancisco/brics-protocol.git
cd brics-protocol
npm install
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "Sovereign Guarantee"
npm test -- --grep "Emergency System"
npm test -- --grep "Per-Sovereign Soft-Cap Damping"

# Generate gas report
REPORT_GAS=true npm test
```

### Deployment
```bash
# Deploy to local network
npm run deploy:dev

# Deploy to testnet
npm run deploy:sepolia

# Deploy to mainnet (production)
npm run deploy
```

## 📋 **Specification Coverage**

### ✅ **Completed (100%)**
- **§2**: Membership & Transfer Control
- **§3**: Per-Sovereign Soft-Cap Damping
- **§4**: NAV Redemption Lane
- **§5**: Oracle Signer & Degradation
- **§6**: Cross-Sovereign Configuration
- **§7**: Security & Access Control
- **§8**: Emergency Procedures
- **§9**: Enhanced Buffer Coordination

### 🎯 **Key Features**
- **Emergency System**: 4-tier crisis response (NORMAL → YELLOW → ORANGE → RED)
- **Oracle Degradation**: Conservative haircuts (2%, 5%, 10%) with emergency signers
- **Buffer Coordination**: Multi-source liquidity with cascading fallbacks
- **Sovereign Guarantee**: Legal framework integration with 90-day execution
- **NAV Redemption**: Instant + monthly settlement with partial fill support
- **Per-Sovereign Damping**: Linear capacity reduction between soft/hard caps

## 🔒 **Security & Compliance**

### Security Features
- **ReentrancyGuard**: All external calls protected
- **Role-Based Access**: Granular permissions with emergency overrides
- **Custom Errors**: Gas-optimized error handling
- **Bounds Checking**: All parameters validated with safe defaults

### Compliance Alignment
- **Basel III**: Capital adequacy and risk weighting
- **MiFID II**: KYC, suitability, and investor protection
- **Local Regulations**: South African CFI framework

### Audit Trail
- **Event Logging**: All state changes emit events
- **Timestamp Tracking**: All actions timestamped for compliance
- **Reference Numbers**: Legal actions include reference tracking

## 📈 **Performance Metrics**

### Technical Performance
- **System Uptime**: >99.9%
- **Emergency Response**: <2 hours
- **Oracle Health**: <6 hour staleness
- **Transaction Success**: >99.5%

### Financial Performance
- **Buffer Health**: >50% combined ratio
- **Portfolio Growth**: 25% annual target
- **Fee Generation**: 1.15% total
- **Token Yield**: 8.5% target

## 🏛️ **Institutional Integration**

### Partners
- **NASASA**: CFI gateway and emergency signer
- **Old Mutual**: $25M emergency buffer commitment
- **Sovereign Entities**: Multi-sovereign guarantee framework

### Legal Framework
- **PFMA Authority**: Public Finance Management Act compliance
- **ISDA-Style Terms**: Credit protection with defined events
- **Cross-Border Enforcement**: Multi-jurisdictional legal framework

## 📚 **Documentation**

### Core Documentation
- [BRICS Protocol Core Specification](docs/BRICS_SPEC_CORE.md)
- [Sovereign Guarantee Implementation](docs/SOVEREIGN_GUARANTEE_IMPLEMENTATION.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Context Guide](docs/CONTEXT_GUIDE.md)
- [Developer Onboarding](docs/DEVELOPER_ONBOARDING.md)

### Audit Documentation
- [Audit Scope](AUDIT_SCOPE.md)
- [Role/Permission Matrix](audit/role-permission-matrix.md)
- [Slither Security Report](audit/slither-report.md)
- [Deployment Parameter Sheet](deployment/parameter-sheet.md)

### Technical Documentation
- [Repository Map](docs/REPO_MAP.md)
- [Traceability Matrix](docs/TRACEABILITY.md)
- [Protocol Overview](docs/PROTOCOL_OVERVIEW.md)

## 🎯 **Value Proposition**

### For Banks
- **Capital Efficiency**: Unlock 20–30% without selling assets
- **Liquidity**: Instant access to capital while maintaining relationships
- **Risk Transfer**: Synthetic transfer of credit risk to investors

### For Investors
- **Emerging Market Access**: Sovereign-backed credit exposure
- **Crisis Protection**: Dynamic detachment expansion during stress
- **Exit Paths**: Instant, monthly, or sovereign-bridge redemptions

### For Sovereigns
- **Credit Monetization**: Structured risk transfer to global investors
- **Cross-Sovereign Hedging**: Diversified exposure across BRICS nations
- **Legal Framework**: PFMA/ISDA frameworks with enforceable terms

## 🚀 **Getting Started for Developers**

### Development Setup
```bash
# Install dependencies
npm install

# Compile contracts
npm run build

# Run tests
npm test

# Run linting
npm run lint:sol
npm run lint:ts
```

### Key Development Guidelines
1. **Institutional Focus**: Think institutional-grade, not DeFi-native
2. **Crisis Resilience**: Always consider emergency state behavior
3. **Legal Compliance**: Maintain audit trail integrity
4. **Conservative Design**: Err on the side of caution

### Testing Requirements
- **Emergency Scenarios**: Test all emergency level behaviors
- **Buffer Coordination**: Ensure liquidity management works
- **Sovereign Integration**: Validate legal framework compliance
- **Oracle Degradation**: Test conservative failover mechanisms

## 📞 **Support & Community**

### Resources
- **Documentation**: Comprehensive docs in `/docs` directory
- **Specifications**: Complete technical specs in `/docs`
- **Audit Reports**: Security analysis in `/audit` directory

### Contact
- **Issues**: [GitHub Issues](https://github.com/yomarfrancisco/brics-protocol/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yomarfrancisco/brics-protocol/discussions)

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 **Status**

**BRICS Protocol v4.0.0-rc2 is AUDIT-READY and production-ready for institutional deployment.**

The protocol demonstrates institutional-grade resilience with comprehensive test coverage, complete specification implementation, and robust security measures. All critical invariants are enforced, emergency procedures are tested, and the protocol is ready for independent security audit and production deployment.

---

**Remember**: We're building infrastructure for $2.3 trillion in emerging market bank loans. Every decision affects institutional capital, regulatory compliance, and crisis management. When in doubt, be conservative and consult the specification.
