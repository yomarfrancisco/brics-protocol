# BRICS Token Deployment Guide

## Overview

This document describes the BRICS token deployment system, which mirrors the USDC deployment pattern but adds support for treasury and whale allocations. The system supports both mock tokens for testing and real tokens for production.

## Architecture

### Token Contracts

1. **BRICSToken** (`contracts/BRICSToken.sol`)
   - Production ERC20 token with 18 decimals
   - Access control for minting/burning
   - Member registry integration for transfer restrictions

2. **MockBRICSToken** (`contracts/mocks/MockBRICSToken.sol`)
   - Test version with mintable functionality
   - 18 decimals matching production
   - No transfer restrictions for testing

### Deployment Scripts

1. **`deploy/01_brics_token.ts`** - Main BRICS token deployment
   - Deploys MockBRICSToken (or uses existing BRICS token)
   - Allocates tokens to treasury, whale, and deployer
   - Supports environment variable configuration

2. **`deploy/03_tranche.ts`** - Updated to use existing BRICS deployment
   - Integrates with BRICS token deployment
   - Deploys related tranche contracts

### Helper Functions

1. **`test/utils/fundBRICS.ts`** - BRICS token funding helper
   - Supports mintable (MockBRICSToken) and whale (forked mainnet) funding
   - Environment-aware logic
   - Deterministic distribution

## Environment Variables

### Required
- `DAO_MULTISIG` - Governance multisig address
- `TREASURY_OPS_MULTISIG` - Treasury operations address

### Optional
- `BRICS_TOKEN_ADDRESS` - Existing BRICS token address (if not deploying new)
- `BRICS_WHALE_ADDRESS` - Whale address for allocations (defaults to deployer)

## Deployment Process

### 1. Local Development
```bash
# Deploy BRICS token with mock allocations
yarn hardhat run deploy/01_brics_token.ts --network hardhat

# Deploy tranche contracts
yarn hardhat run deploy/03_tranche.ts --network hardhat
```

### 2. Testnet/Mainnet
```bash
# Set environment variables
export BRICS_TOKEN_ADDRESS=0x...  # Real BRICS token address
export BRICS_WHALE_ADDRESS=0x...  # Whale address with BRICS

# Deploy (will use existing token)
yarn hardhat run deploy/01_brics_token.ts --network <network>
```

## Allocations

### Default Allocations (Mock Deployment)
- **Treasury**: 10,000,000 BRICS (10M)
- **Whale**: 50,000,000 BRICS (50M)
- **Deployer**: 1,000,000 BRICS (1M)

### Custom Allocations
Modify the allocation constants in `deploy/01_brics_token.ts`:
```typescript
const TREASURY_ALLOCATION = ethers.parseUnits("10000000", 18); // 10M BRICS
const WHALE_ALLOCATION = ethers.parseUnits("50000000", 18);    // 50M BRICS
const DEPLOYER_ALLOCATION = ethers.parseUnits("1000000", 18);  // 1M BRICS
```

## Testing

### Unit Tests
```bash
# Test BRICS token deployment
yarn hardhat test test/fast/brics-deployment.spec.ts

# Test integration with existing system
yarn hardhat test test/fast/brics-integration.spec.ts
```

### Helper Functions
```typescript
import { fundBRICS } from "../utils/fundBRICS";

// Fund participants with BRICS
await fundBRICS(bricsToken, [treasury, whale, member], {
  amount: 10_000_000n * 10n ** 18n
});
```

## Integration with Existing System

### Treasury Integration
- Treasury can hold both USDC and BRICS
- Supports USDC payouts via `pay()` function
- BRICS held by treasury operations address

### InstantLane Integration
- BRICS tokens can be redeemed for USDC
- Member gating enforced via MemberRegistry
- Daily caps and price bounds applied

### Whale Operations
- Large BRICS transfers supported
- Integration with AMM/PMM for liquidity
- Price impact calculations

## Security Considerations

### Access Control
- BRICSToken uses OpenZeppelin AccessControl
- MINTER_ROLE and BURNER_ROLE for token operations
- Member registry for transfer restrictions

### Treasury Security
- Treasury operations require PAY_ROLE
- Separate treasury operations multisig
- Buffer target monitoring

### Testing Security
- Mock tokens for deterministic testing
- No real token minting in test environment
- Fork testing with real token addresses

## Troubleshooting

### Common Issues

1. **"Transaction reverted without reason"**
   - Check if oracle is properly configured
   - Verify member registry setup
   - Ensure sufficient token balances

2. **"USDC funding failed"**
   - Check if MockUSDC is deployed
   - Verify USDC_WHALE environment variable
   - Ensure network is forked (if using whale)

3. **"BRICS funding failed"**
   - Check if MockBRICSToken is deployed
   - Verify BRICS_WHALE environment variable
   - Ensure network is forked (if using whale)

### Debug Commands
```bash
# Check token balances
yarn hardhat run scripts/checkUSDC.ts --network <network>
yarn hardhat run scripts/verifyAddresses.ts --network <network>

# Test token operations
yarn hardhat test test/fast/brics-deployment.spec.ts
yarn hardhat test test/fast/brics-integration.spec.ts
```

## Future Enhancements

1. **Multi-token Support**
   - Support for additional stablecoins
   - Cross-chain token bridges
   - Token whitelisting

2. **Advanced Treasury Features**
   - Automated rebalancing
   - Yield farming integration
   - Risk management tools

3. **Enhanced Testing**
   - Property-based testing
   - Fuzz testing for edge cases
   - Integration with external protocols

