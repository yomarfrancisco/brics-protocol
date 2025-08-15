# Issue #61 Deep-Dive Bundle

**Issue:** `mintFor` function in `IssuanceControllerV3.sol` reads `usdcAmt == 0` even when correct calldata is passed, causing `AmountZero()` reverts.

**Bundle Created:** `support/#61-mintfor-deepdive-fe6a1f6/`

## Key Files Included:

### Core Contract Files:
- `contracts/IssuanceControllerV3.sol` - The buggy contract
- `contracts/interfaces/IIssuanceControllerV3.sol` - Interface with signature mismatch
- `contracts/libraries/IssuanceGuard.sol` - Library used by controller
- `contracts/ConfigRegistry.sol` - Configuration management
- `contracts/mocks/MockNAVOracle.sol` - NAV oracle mock
- `contracts/oracles/NAVOracleV3.sol` - Real NAV oracle

### Quarantined Test Files:
- `test/issuance.capacity.boundary.spec.ts` - Quarantined due to mintFor bug
- `test/issuance.capacity.fuzz.spec.ts` - Quarantined due to mintFor bug  
- `test/issuance.v3.spec.ts` - Quarantined due to mintFor bug
- `test/sovereign.guarantee.spec.ts` - Quarantined due to mintFor bug
- `test/security/precision.spec.ts` - Quarantined due to mintFor bug
- `test/security/reentrancy.spec.ts` - Quarantined due to mintFor bug

### Utility Files:
- `test/utils/nav-helpers.ts` - NAV API compatibility helpers
- `test/utils/` - Test utilities

### Configuration:
- `hardhat.config.ts` - Hardhat configuration
- `package.json` - Dependencies
- Various linting/config files

## Evidence of the Bug:

1. **Interface Mismatch:** `IIssuanceControllerV3` defines 4-parameter `mintFor`, but implementation uses 5 parameters
2. **AmountZero Error:** Contract reverts at line 807 with `AmountZero()` despite receiving correct calldata
3. **Mirror Contract Proof:** Test harness proves calldata is correctly encoded and sent
4. **Quarantined Tests:** Multiple test files quarantined with `this.skip()` referencing Issue #61

## Next Steps:
1. Align interface signature with implementation
2. Investigate parameter shadowing/overwrite in `mintFor` function
3. Add debug events to pinpoint where `usdcAmt` becomes zero
4. Fix the contract bug and unquarantine tests

**Bundle Location:** `support/#61-mintfor-deepdive-fe6a1f6/`
**Commit:** `fe6a1f6`
