# NASASA Gateway

## Overview

The NASASA Gateway is the single entry point for mint and redeem operations in the BRICS protocol. It enforces member gating, emergency rules, and daily instant limits while providing dual-lane redemption functionality.

## Architecture

### Dual-Lane Redemption System

1. **Instant Lane**: Direct redemption via Pre-Tranche Buffer or AMM/PMM
2. **Primary Lane**: Monthly NAV strike with tradable ERC-1155 RedemptionClaim

### Key Components

- **NASASAGateway**: Main contract handling mint/redeem operations
- **RedemptionQueue**: FIFO queue for primary lane claims
- **RedemptionClaim**: ERC-1155 tokens representing redemption claims

## Mint Flow

1. User calls `mint(usdcAmount, recipient)`
2. Gateway validates:
   - Recipient is a member
   - Issuance is allowed
   - IRB/buffer requirements are met
3. USDC is transferred to Treasury
4. Tokens are minted via IssuanceController
5. Event `Minted` is emitted

### Mint Calculation

```
tokensOut = (usdcAmount * PRICE_RAY) / navRay
```

Where:
- `PRICE_RAY = 1e27`
- `navRay` is the current NAV from NAVOracle

## Redemption Flows

### Instant Lane

1. User calls `redeem(tokenAmount, INSTANT)`
2. Gateway validates:
   - Caller is a member
   - Daily instant cap not exceeded
   - Emergency level allows instant redemption
3. Tokens are burned
4. USDC payout is sourced from:
   - Pre-Tranche Buffer (priority)
   - AMM/PMM (if buffer insufficient)
5. Event `InstantRedeemed` is emitted

### Primary Lane

1. User calls `redeem(tokenAmount, PRIMARY)`
2. Gateway validates:
   - Caller is a member
   - Not in freeze window
3. Tokens are burned
4. ERC-1155 RedemptionClaim is minted
5. Event `PrimaryQueued` is emitted

## Strike Processing

1. OPS calls `processMonthEndStrike()`
2. Current NAV is retrieved
3. All claims for the strike are processed
4. Pro-rata is applied if total exceeds redeem cap
5. Each claim is marked with payable amount
6. Event `StrikeProcessed` is emitted

## Settlement

1. User calls `settleClaim(claimId)` within T+5 window
2. Gateway validates:
   - Caller is claim holder
   - Claim not already settled
   - Within settlement window
3. USDC is paid from Treasury
4. Claim is burned
5. Event `ClaimSettled` is emitted

## Emergency Controls

### Freeze Windows

| Emergency Level | Freeze Window |
|----------------|---------------|
| NORMAL/YELLOW  | 24 hours      |
| ORANGE         | 48 hours      |
| RED            | 72 hours      |

### Daily Instant Caps

- Default: $50,000 USDC per member per day
- Resets at UTC midnight
- Configurable per member

## Configuration

### Parameters

- `redeemCapBps`: Pro-rata threshold (default: 25%)
- `ammMaxSlippageBps`: AMM slippage bounds (default: 5%)
- `emergencyLevel`: Current emergency level (0-3)

### Roles

- `OPS_ROLE`: Process strikes, set timestamps
- `GOV_ROLE`: Unpause gateway
- `ECC_ROLE`: Pause gateway (emergency)

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **AccessControl**: Role-based permissions
- **Pausable**: Emergency pause functionality
- **SafeERC20**: Safe token transfers
- **Member Gating**: All operations require membership

## Events

### Mint Events
```solidity
event Minted(
    address indexed to,
    uint256 usdcIn,
    uint256 tokensOut,
    uint256 navRay,
    uint256 ts
);
```

### Redemption Events
```solidity
event InstantRedeemed(
    address indexed member,
    uint256 tokenAmount,
    uint256 usdcPaid,
    bytes32 source,
    uint256 ts
);

event PrimaryQueued(
    address indexed member,
    uint256 claimId,
    uint256 tokenAmount,
    uint256 strikeTs
);
```

### Strike Events
```solidity
event StrikeProcessed(
    uint256 ts,
    uint256 navRay,
    uint256 queuedCount,
    uint256 proRataBps
);

event ClaimSettled(
    address indexed member,
    uint256 claimId,
    uint256 usdcPaid
);
```

## Error Codes

- `NotMember`: Caller/recipient is not a member
- `IssuanceHalted`: Issuance is currently halted
- `IRBLow`: IRB requirements not met
- `InstantCapExceeded`: Daily instant cap exceeded
- `FrozenPreStrike`: In freeze window before strike
- `SettlementWindowOver`: T+5 settlement window expired
- `ClaimSettled`: Claim already settled

## Integration Points

### Required Contracts

- **MemberRegistry**: Member validation
- **ConfigRegistry**: Configuration parameters
- **NAVOracleV3**: NAV pricing
- **IssuanceControllerV3**: Token minting
- **BRICSToken**: Token operations
- **PreTrancheBuffer**: Instant redemption source
- **RedemptionClaim**: Claim management
- **Treasury**: USDC custody and payments

### External Dependencies

- **AMM/PMM**: Secondary instant redemption source
- **Off-chain OMS**: Tail correlation and sovereign utilization parameters

## Testing

### Test Coverage

- Member gating enforcement
- Mint lifecycle with correct token calculation
- Daily instant cap enforcement
- Source selection (buffer vs AMM)
- Freeze window enforcement
- Strike processing with pro-rata
- T+5 settlement window
- Reentrancy protection
- Access control
- Invariants (no minting on redemption path)

### Test Files

- `test/fast/gateway/nasasa-gateway.spec.ts`: Main gateway tests
- `test/fast/redemption/`: Redemption-specific tests

## Deployment

### Constructor Parameters

```solidity
constructor(
    address _memberRegistry,
    address _configRegistry,
    address _navOracle,
    address _issuanceController,
    address _bricsToken,
    address _preTrancheBuffer,
    address _redemptionClaim,
    address _treasury,
    address _trancheManager,
    address _usdc
)
```

### Post-Deployment Setup

1. Grant roles to appropriate addresses
2. Set initial strike timestamp
3. Configure emergency parameters
4. Verify all integration points

## Monitoring

### Key Metrics

- Daily mint/redeem volumes
- Instant vs primary lane usage
- Strike processing times
- Settlement success rates
- Emergency level changes

### Alerts

- Daily instant cap approaching limits
- Strike processing delays
- Settlement window expirations
- Emergency level escalations

