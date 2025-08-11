# Coverage Bump Plan: Targeted Tests for +2-3% Fast Track

## Current Status
- **Fast Track Coverage**: 26.55% statements, 27.61% lines
- **Target**: Increase to ~30% statements/lines
- **Scope**: Contracts in fast mode (not skipped by .solcover.js)

## Identified Untested Paths

### 1. BRICSToken.sol (0% coverage on core functions)
- **Lines 35-37**: `mint()` and `burn()` functions (0 hits)
- **Lines 4-9**: Access control logic in `_update()` (0 hits)
- **Expected Delta**: +5-8% statements, +3-5% lines

### 2. OperationalAgreement.sol (0% coverage)
- **Lines 23-29**: Constructor and role setup (0 hits)
- **Lines 33-44**: `setOperator()` function (0 hits)
- **Lines 47-60**: Member management functions (0 hits)
- **Expected Delta**: +15-20% statements, +10-15% lines

### 3. Treasury.sol (0% coverage)
- **Lines 26-30**: Constructor and role setup (0 hits)
- **Lines 38-44**: `fund()` and `pay()` functions (0 hits)
- **Lines 56-71**: `getLiquidityStatus()` function (0 hits)
- **Expected Delta**: +8-12% statements, +6-10% lines

### 4. TrancheManagerV2.sol (Low coverage on governance functions)
- **Lines 80-91**: `setClaimRegistry()`, `setTriggersBreached()`, `confirmSovereignGuarantee()` (0 hits)
- **Lines 94-112**: `adjustSuperSeniorCap()`, `setIssuanceLocked()`, `attestSupermajority()` (0 hits)
- **Expected Delta**: +10-15% statements, +8-12% lines

## Test Stubs Required

1. **BRICSToken Tests**:
   - Test mint/burn with proper access control
   - Test `_update()` function with various scenarios
   - Test role-based access restrictions

2. **OperationalAgreement Tests**:
   - Test constructor with valid parameters
   - Test `setOperator()` with role checks
   - Test member approval/revocation flows
   - Test pool whitelisting functionality

3. **Treasury Tests**:
   - Test constructor and role setup
   - Test `fund()` function with USDC transfers
   - Test `pay()` function with role restrictions
   - Test `getLiquidityStatus()` calculations

4. **TrancheManagerV2 Governance Tests**:
   - Test claim registry setting
   - Test trigger breach management
   - Test sovereign guarantee confirmation
   - Test super senior cap adjustments
   - Test issuance lock management
   - Test supermajority attestation

## Implementation Priority
1. **High Impact**: BRICSToken (core token functionality)
2. **Medium Impact**: Treasury (liquidity management)
3. **Medium Impact**: OperationalAgreement (member management)
4. **Lower Impact**: TrancheManagerV2 governance functions

## Expected Total Impact
- **Statements**: +38-55% (from 26.55% to ~30-35%)
- **Lines**: +27-42% (from 27.61% to ~30-35%)
- **Functions**: +15-25 functions tested

## Notes
- Focus on core functionality first
- Ensure proper access control testing
- Include both success and failure scenarios
- Maintain test isolation and readability
