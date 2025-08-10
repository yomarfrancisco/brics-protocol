# Developer Onboarding Guide

## Welcome to BRICS Protocol

You're joining a project building **institution-grade synthetic risk transfer infrastructure** for emerging market bank loan portfolios. This is not a typical DeFi protocol - it's designed to meet institutional standards while enabling the largest capital efficiency transformation in emerging market banking history.

## What You Need to Know

### The Vision
**BRICS runs like a stablecoin but survives like a AAA bond** - sovereign-backed, crisis-resilient synthetic assets that unlock $2.3T in emerging market loan portfolios.

### Core Innovation
**Adaptive Sovereign Credit Infrastructure** with:
- Multi-layered capital stack (Bank Equity → Mezzanine → Sovereign Guarantee → BRICS Super-Senior)
- Dynamic crisis response (100-108% detachment expansion)
- Multi-sovereign coordination across BRICS nations
- Legal framework integration (PFMA/ISDA compliance)

### Institutional Requirements
This is **not** a typical DeFi protocol. Every decision must consider:

1. **Legal Compliance**: PFMA authority, ISDA-style terms, enforceable sovereign guarantees
2. **Crisis Resilience**: Emergency response systems, buffer coordination, sovereign activation
3. **Multi-Sovereign Coordination**: Cross-border risk diversification, legal frameworks
4. **Audit Readiness**: Complete on-chain audit trails, legal milestone tracking
5. **Regulatory Alignment**: Basel III, MiFID II compliance considerations

## Key Concepts

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

### Emergency System
- **NORMAL (0)**: Standard operations, 100-102% detachment
- **YELLOW (1)**: Elevated risk, reduced issuance rates
- **ORANGE (2)**: High risk, issuance throttling, extended cooldowns
- **RED (3)**: Crisis mode, issuance halted, sovereign guarantee activation

### Sovereign Guarantee Integration
- **Legal Framework**: PFMA authority, ISDA-style terms, 7-day notice, 90-day execution
- **Claim Lifecycle**: Trigger → Notice → Acknowledgment → Settlement
- **Crisis Expansion**: Dynamic detachment expansion (105-108%) with sovereign confirmation
- **Multi-Sovereign**: Cross-sovereign hedging across BRICS nations

## Development Philosophy

### Priority Order
1. **Institutional Compliance** - Legal framework, regulatory requirements
2. **Crisis Resilience** - Emergency response, sovereign guarantee activation
3. **Security** - Reentrancy protection, access controls, audit trails
4. **Functionality** - Core protocol features and user experience

### Code Quality Standards
- **Documentation**: Every public function must have comprehensive NatSpec comments
- **Testing**: 100% test coverage for critical paths, especially emergency scenarios
- **Audit Trail**: All state changes must emit events for legal compliance
- **Access Control**: Role-based permissions with clear separation of concerns

## Key Contracts to Understand

### Core Protocol
- **IssuanceControllerV3**: Mint/redeem logic with emergency controls
- **TrancheManagerV2**: Detachment band management (100-108%)
- **ConfigRegistry**: Global risk parameters and emergency levels
- **ClaimRegistry**: Sovereign guarantee claim tracking

### Risk Management
- **PreTrancheBuffer**: Instant redemption liquidity
- **BRICSToken**: ERC-20 with transfer restrictions
- **MemberRegistry**: Membership gating and pool whitelisting

### Emergency System
- **SovereignClaimToken**: Sovereign guarantee representation
- **RedemptionClaim**: Monthly redemption queue
- **OperationalAgreement**: Legal framework integration

## Development Workflow

### Before Starting
1. Read the [BRICS Protocol Core Specification](BRICS_SPEC_CORE.md)
2. Understand the [Sovereign Guarantee Implementation](SOVEREIGN_GUARANTEE_IMPLEMENTATION.md)
3. Review the [Context Guide](CONTEXT_GUIDE.md) for quick reference
4. Check the [Implementation Roadmap](IMPLEMENTATION_ROADMAP.md) for priorities

### Testing Requirements
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "Sovereign Guarantee"
npm test -- --grep "Emergency System"
npm test -- --grep "Per-Sovereign Soft-Cap Damping"
```

### Code Review Checklist
- [ ] Institutional compliance considered
- [ ] Crisis resilience preserved
- [ ] Legal framework requirements met
- [ ] Audit trail integrity maintained
- [ ] Emergency scenarios tested
- [ ] Sovereign guarantee flows validated

## Common Pitfalls

### Don't Assume Standard DeFi Patterns
- **Emergency Systems**: Always consider crisis scenarios
- **Legal Compliance**: Every feature needs legal framework consideration
- **Multi-Sovereign**: Think cross-border, not single jurisdiction
- **Audit Trails**: All state changes need events for legal compliance

### Do Follow Institutional Standards
- **Documentation**: Comprehensive NatSpec for all public functions
- **Testing**: Emergency scenarios, crisis response, sovereign activation
- **Security**: Reentrancy protection, access controls, audit trails
- **Compliance**: Legal framework integration, regulatory considerations

## Getting Help

### Documentation
- [BRICS Protocol Core Specification](BRICS_SPEC_CORE.md) - Complete technical spec
- [Sovereign Guarantee Implementation](SOVEREIGN_GUARANTEE_IMPLEMENTATION.md) - Legal framework details
- [Repository Map](REPO_MAP.md) - Contract responsibilities
- [Context Guide](CONTEXT_GUIDE.md) - Quick reference

### Questions to Ask
- How does this affect crisis response?
- What are the legal framework implications?
- How does this impact sovereign guarantee activation?
- What audit trail requirements exist?
- How does this support multi-sovereign coordination?

## Remember

You're building infrastructure that will handle **$2.3 trillion** in emerging market assets with **sovereign backing** and **crisis resilience**. Every line of code matters for institutional adoption and legal compliance.

**Think institutional-grade, not DeFi-native.** 🚀
