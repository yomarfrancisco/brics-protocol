# Pull Request

## 📋 Checklist

### Pre-submission
- [ ] **Fixtures Fresh**: `yarn fixtures:check` passes (fixtures < 30 days old)
- [ ] **Gas Report**: `GAS_REPORT=true yarn hardhat test` generates gas-report.txt
- [ ] **Audit Bundle**: `yarn audit:bundle` builds successfully
- [ ] **Tests Pass**: All unit, integration, and property tests pass
- [ ] **No Protocol Changes**: No contract ABI/storage changes (unless explicitly needed)

### Code Quality
- [ ] **Conventional Commits**: Title follows `type(scope): description` format
- [ ] **Deterministic**: All outputs are deterministic (seeded randomness where needed)
- [ ] **CI Safe**: Changes won't break CI jobs
- [ ] **Documentation**: Updated relevant docs (if applicable)

### Observability
- [ ] **Gas Impact**: Checked gas usage impact (if contract changes)
- [ ] **Audit Trail**: New functionality has appropriate event logging
- [ ] **Test Coverage**: Added/updated tests for new functionality

## 🎯 Description

<!-- Describe the changes and their purpose -->

## 🔍 Testing

<!-- Describe how you tested the changes -->

### Local Testing
```bash
# Commands run locally
yarn test
yarn fixtures:check
GAS_REPORT=true yarn hardhat test
```

### CI Verification
- [ ] Unit & Integration Tests: ✅
- [ ] Smoke (Fresh Clone): ✅  
- [ ] Swap E2E (Replay): ✅
- [ ] Risk API (Test): ✅
- [ ] Gas Report (optional): ✅
- [ ] Audit Bundle (optional): ✅

## 📊 Impact

<!-- Describe the impact of these changes -->

- **Protocol Changes**: None / Minor / Major
- **Gas Impact**: None / Decrease / Increase
- **Breaking Changes**: None / Yes (describe)
- **Observability**: Enhanced / Maintained / Reduced

## 🔗 Related

<!-- Link to related issues, discussions, etc. -->

- Fixes #(issue)
- Related to #(issue)
- Part of milestone: v0.2.1

## 📝 Notes

<!-- Any additional notes for reviewers -->

---

*This PR template helps ensure quality and observability standards are maintained.*
