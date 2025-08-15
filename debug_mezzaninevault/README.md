# MezzanineVault CI Test Failure Debug Archive

This archive contains all files relevant to debugging the MezzanineVault CI test failure.

## Issue Description

The test "should revert withdraw before reinvestUntil when principalLocked is true" was failing in CI due to non-deterministic behavior related to:
- Block timestamp vs reinvestUntil timing
- Pool membership/whitelist checks
- Time-based test logic

## Files Included

### Test Files
- `test/mezzanine-vault.spec.ts` - The main test file containing the failing test case
- `test/bootstrap.ts` - Test bootstrap configuration

### Contract Files
- `contracts/MezzanineVault.sol` - The main vault contract with reinvestment controls
- `contracts/mocks/MockUSDC.sol` - Mock USDC token for testing

### Configuration Files
- `hardhat.config.ts` - Hardhat configuration with test settings
- `.github/workflows/tests.yml` - GitHub Actions test workflow
- `.github/workflows/ci.yml` - GitHub Actions CI workflow

## Key Test Case

The failing test case is in `test/mezzanine-vault.spec.ts` around line 141:

```typescript
it("should revert withdraw before reinvestUntil when principalLocked is true", async function () {
  // Get current block timestamp and check reinvestUntil
  const latest = await ethers.provider.getBlock('latest');
  const currentTime = latest.timestamp;
  const reinvestUntil = await mezzanineVault.reinvestUntil();
  
  // Ensure user1 is whitelisted (already done in beforeEach)
  // Ensure principalLocked is true (already set in constructor)
  
  const withdrawAmount = ethers.parseUnits("10", 6);
  
  // BEFORE: expect revert with specific error message if current time < reinvestUntil
  if (currentTime < reinvestUntil) {
    await expect(
      mezzanineVault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
    ).to.be.revertedWith("reinvest lock");
  }
  
  // Advance time past reinvestUntil
  await ethers.provider.send("evm_setNextBlockTimestamp", [reinvestUntil + 1]);
  await ethers.provider.send("evm_mine", []);
  
  // AFTER: expect success (or at least not the 'reinvest lock' error)
  await expect(
    mezzanineVault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
  ).to.not.be.reverted;
});
```

## Contract Logic

The MezzanineVault contract has this key logic in the withdraw function:

```solidity
function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
    require(block.timestamp > reinvestUntil || !principalLocked, "reinvest lock");
    return super.withdraw(assets, receiver, owner);
}
```

## CI Configuration

The CI workflows use:
- Yarn 4.9.2 via Corepack
- `yarn install --immutable` for dependency installation
- `PRICING_PROVIDER=stub BANK_DATA_MODE=off` environment variables
- `yarn test` command for running tests

## Debug Steps

1. Run the test locally: `yarn test test/mezzanine-vault.spec.ts`
2. Check the specific failing test case
3. Verify the reinvestUntil logic and timing
4. Ensure whitelist setup is correct
5. Check for any race conditions or timing issues
