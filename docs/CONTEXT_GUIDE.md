# BRICS Protocol Context Guide

## Quick Reference for Developers

### **What We're Building**
A sovereign-backed, member-gated, yield-bearing token that is always the safest slice of bank credit, with automated issuance, redemption, risk controls, and emergency liquidity — designed so it can run like a stablecoin but survive like a AAA bond.

### **Key Context for Every Decision**

#### **1. Institutional Grade Requirements**
- **Target Market**: $2.3 trillion emerging market bank loan portfolios
- **Regulatory Framework**: Basel III, MiFID II, South African CFI regulations
- **Institutional Partners**: NASASA (CFI), Old Mutual ($25M commitment), Sovereign entities
- **Success Criteria**: 99.9% uptime, <2h emergency response, >67% governance participation

#### **2. Crisis Management Philosophy**
- **Conservative by Design**: Always err on the side of caution
- **Graduated Response**: Multiple emergency levels with escalating restrictions
- **Institutional Backstop**: Multiple layers of protection (buffers, sovereign, emergency powers)
- **Deadlock Resolution**: Automatic sunset clauses and emergency overrides

#### **3. Risk Transfer Mechanics**
- **Super-Senior Tranche**: 100-102% normal, expandable to 108% in catastrophic scenarios
- **Capital Stack**: Bank Equity (0-5%) → Mezzanine (5-10%) → Sovereign (10-100%) → BRICS (100-108%)
- **Buffer Coordination**: $10M Pre-Tranche + Dynamic IRB + Emergency reserves

### **Critical Implementation Guidelines**

#### **When Adding New Features**
1. **Check Regulatory Impact**: Does this affect Basel III compliance?
2. **Consider Crisis Scenarios**: How does this behave during emergency states?
3. **Institutional Integration**: Does this work with NASASA/Old Mutual procedures?
4. **Buffer Coordination**: Does this affect liquidity management?
5. **Governance Continuity**: Can this cause deadlocks during crises?

#### **Emergency State Awareness**
- **NORMAL**: Standard operations, full capacity
- **YELLOW**: Increased monitoring, buffer requirements
- **ORANGE**: Reduced issuance, extended cooldowns
- **RED**: Issuance halted, sovereign backstop active
- **CATASTROPHIC**: Super emergency powers (105-108% detachment)

#### **Oracle Degradation Response**
- **>2h stale**: 2% haircut, continue operations
- **>6h stale**: 5% haircut, reduced capacity
- **>24h stale**: 10% haircut, emergency signers only
- **Complete failure**: Conservative static mode

### **Institutional Context**

#### **NASASA (Co-operative Financial Institution)**
- **Role**: CFI gateway, emergency signer, regulatory compliance
- **Requirements**: 99.5% uptime, 48h processing, 24/7 emergency response
- **Financial**: $500K initial, $2M emergency participation
- **Regulatory**: PA authorization, FSCA license

#### **Old Mutual (JSE-listed)**
- **Role**: Emergency signer, risk committee, model validation
- **Commitment**: $25M emergency buffer ($5M immediate, $20M extended)
- **Obligations**: 100% fee reinvestment for 60 months, <2h response time
- **Performance**: >90% governance participation

#### **Sovereign Guarantee**
- **Coverage**: 90% of notional, triggered at Bank+Mezz exhaustion
- **Timeline**: 48h trigger, 7d notice, 90d execution maximum
- **Legal**: PFMA authority, ISDA framework, cross-border enforcement

### **Technical Architecture Principles**

#### **Security First**
- **Reentrancy Protection**: All external calls protected
- **Role-Based Access**: Granular permissions with emergency overrides
- **Custom Errors**: Gas-optimized error handling
- **Bounds Checking**: All parameters validated with safe defaults

#### **Crisis Resilience**
- **Conservative Degradation**: Oracle failures result in reduced capacity, not increased risk
- **Buffer Coordination**: Multiple liquidity sources with cascading fallbacks
- **Governance Continuity**: Deadlock resolution with automatic sunset clauses
- **Emergency Powers**: Time-limited overrides with institutional oversight

#### **Regulatory Compliance**
- **Basel III**: Capital adequacy, risk weighting, operational risk
- **MiFID II**: KYC, suitability, risk disclosure, best execution
- **Local Regulations**: South African CFI framework, cross-border enforcement

### **Development Workflow**

#### **Before Implementing**
1. **Read the Spec**: Check BRICS_SPEC_CORE.md for requirements
2. **Check Traceability**: Verify against TRACEABILITY.md
3. **Consider Crisis**: How does this behave in emergency states?
4. **Institutional Impact**: Does this affect NASASA/Old Mutual procedures?

#### **During Implementation**
1. **Conservative Design**: Err on the side of caution
2. **Emergency States**: Test all emergency level behaviors
3. **Buffer Coordination**: Ensure liquidity management works
4. **Governance**: Avoid deadlock scenarios

#### **After Implementation**
1. **Comprehensive Testing**: All emergency scenarios
2. **Documentation**: Update specs and traceability
3. **Security Review**: Check for vulnerabilities
4. **Regulatory Review**: Ensure compliance

### **Common Pitfalls to Avoid**

#### **1. Ignoring Emergency States**
- **Problem**: Features that work in normal mode but fail in emergencies
- **Solution**: Always test emergency state behavior

#### **2. Buffer Coordination Issues**
- **Problem**: Features that deplete buffers without coordination
- **Solution**: Coordinate with buffer management systems

#### **3. Governance Deadlocks**
- **Problem**: Features that can cause governance paralysis during crises
- **Solution**: Include automatic sunset clauses and emergency overrides

#### **4. Regulatory Non-Compliance**
- **Problem**: Features that violate Basel III or MiFID II
- **Solution**: Regular compliance reviews and regulatory consultation

#### **5. Institutional Integration Gaps**
- **Problem**: Features that don't work with NASASA/Old Mutual procedures
- **Solution**: Regular institutional consultation and testing

### **Success Metrics**

#### **Technical Performance**
- System Uptime: >99.9%
- Emergency Response: <2 hours
- Oracle Health: <6 hour staleness
- Transaction Success: >99.5%

#### **Financial Performance**
- Buffer Health: >50% combined ratio
- Portfolio Growth: 25% annual
- Fee Generation: 1.15% total
- Token Yield: 8.5% target

#### **Governance & Compliance**
- Governance Participation: >67%
- Regulatory Compliance: Zero findings
- Emergency Preparedness: <15% drill failure rate
- Stakeholder Satisfaction: >90%

### **Resources**

#### **Specification Documents**
- `docs/BRICS_SPEC_CORE.md`: Complete technical specification
- `docs/TRACEABILITY.md`: Implementation mapping
- `docs/REPO_MAP.md`: Repository structure

#### **Implementation Status**
- **Completed**: §2 (Membership), §3 (Soft-Cap Damping), §6 (Sovereign Config), §7 (Security)
- **In Progress**: §4 (NAV Redemption), §5 (Oracle Degradation)
- **Planned**: Enhanced crisis management, institutional integration

#### **Testing & Validation**
- `test/issuance.v3.spec.ts`: Per-sovereign damping tests
- `test/config.sovereigns.spec.ts`: Sovereign configuration tests
- Emergency scenario testing (planned)
- Institutional integration testing (planned)

---

**Remember**: We're building infrastructure for $2.3 trillion in emerging market bank loans. Every decision affects institutional capital, regulatory compliance, and crisis management. When in doubt, be conservative and consult the specification.
