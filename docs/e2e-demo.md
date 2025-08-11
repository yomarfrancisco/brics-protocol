# CDS Swap End-to-End Demo

This document provides a 60-second tutorial for running the CDS Swap end-to-end demo with deterministic pricing.

## Overview

The demo demonstrates a complete CDS swap lifecycle:
1. **Propose** a CDS swap with fixed parameters
2. **Activate** the swap (BROKER_ROLE only)
3. **Generate** a deterministic price quote
4. **Settle** the swap with calculated P&L

## Quick Start

### Prerequisites

- Node.js and Yarn installed
- Hardhat environment set up

### Running the Demo

1. **Start the demo** (deterministic mode, no external services):
   ```bash
   yarn hardhat swap:demo --obligor ACME-LLC --tenor 30 --asof 1600000000 --notional 1000000 --fixed-spread 80
   ```

2. **Expected output**:
   ```
   🚀 Starting CDS Swap E2E Demo...
   📋 Parameters: ACME-LLC, 30d, 1600000000, $1000000, 80bps
   👤 Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   
   📦 Deploying contracts...
   ✅ CdsSwapEngine deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   
   🔗 Setting up price oracle...
   ✅ Mock oracle deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   ✅ Price oracle configured
   ✅ Broker role granted to deployer
   
   📊 Generating deterministic quote...
   ✅ Quote generated: 800bps fair, 7000bps correlation
   
   📝 Proposing swap...
   ⏰ Demo times: start=16000000003000, maturity=16000002595000
   ✅ Swap proposed: 0xcef026066191c0d49b413d9a78b76f8b9e26a05fce7c0b080884243135f11a44
   
   ⚡ Activating swap...
   ✅ Swap activated
   
   💰 Settling swap...
   ✅ Swap settled with payout: 10000
   
   🔍 Verifying results...
   📊 Swap status: Settled
   
   ============================================================
   🎯 E2E Demo Results
   ============================================================
   Swap ID: 0xcef026066191c0d49b413d9a78b76f8b9e26a05fce7c0b080884243135f11a44
   Fixed Spread: 80 bps
   Fair Spread: 800 bps
   Correlation: 7000 bps
   Payout: 10000
   Recovered Signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Expected Signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Signature Match: ✅
   ============================================================
   
   💾 Demo output saved to demo_output.json
   ```

## How It Works

### 1. Contract Deployment
- Deploys `CdsSwapEngine` with deployer as admin
- Deploys `MockPriceOracleAdapter` for testing
- Grants `BROKER_ROLE` to deployer

### 2. Swap Proposal
- Creates swap parameters with future start time
- Calls `proposeSwap()` to create swap metadata
- Generates unique `swapId` using parameters + timestamp

### 3. Quote Generation
- Builds deterministic payload matching Pricing Service format
- Uses seed 42 for deterministic private key
- Signs digest with EIP-191 prefix (matches RiskSignalLib)

### 4. Swap Activation
- Calls `activateSwap()` with `swapId` (BROKER_ROLE required)
- Updates swap status from Proposed → Active

### 5. Settlement
- Calls `settleSwap(swapId, quote)` with signed quote
- Verifies signature using `RiskSignalLib.recoverSigner()`
- Calculates P&L: `(fairSpread - fixedSpread) * notional * elapsedDays / tenorDays`
- Updates status to Settled

## Signature Verification

The demo uses the same signature verification as the Pricing Service:

1. **Payload Structure**: `[portfolioId, asOf, riskScore, correlationBps, spreadBps, modelIdHash, featuresHash]`
2. **Digest**: `keccak256(abi.encode(payload))`
3. **EIP-191**: `MessageHashUtils.toEthSignedMessageHash(digest)`
4. **Recovery**: `ECDSA.recover(ethHash, signature)`

## Deterministic Values

The demo uses deterministic values for reproducible results:
- **Private Key**: `0x000000000000000000000000000000000000000000000000000000000000002a` (seed 42)
- **Features**: `{"industry": "technology", "region": "us", "size": "large", "rating": "bbb"}`
- **Model ID**: `"baseline-v0"`
- **Portfolio ID**: `keccak256("demo-portfolio")`

## Payout Calculation

The demo calculates P&L using the formula:
```
payout = (fairSpreadBps - fixedSpreadBps) * (notional / 10000) * (elapsedDays / tenorDays)
```

Example:
- Fixed Spread: 80 bps (0.8%)
- Fair Spread: 800 bps (8.0%)
- Notional: 1,000,000 USDC
- Tenor: 30 days
- Elapsed: 30 days (settled at maturity)

Payout = (800 - 80) * (1,000,000 / 10,000) * (30 / 30) = 720 * 100 = 72,000

## Output Files

The demo generates:
- **Console output**: Real-time progress and results
- **demo_output.json**: Structured data for CI/automation

```json
{
  "swapId": "0xcef026066191c0d49b413d9a78b76f8b9e26a05fce7c0b080884243135f11a44",
  "fixedSpreadBps": 80,
  "fairSpreadBps": 800,
  "correlationBps": 7000,
  "payout": "10000",
  "recoveredSigner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "expectedSigner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "signatureMatch": true,
  "status": "Settled"
}
```

## Integration with Pricing Service

In production, the demo would:
1. Call the Pricing Service `/v1/price` endpoint
2. Use the returned `digest` and `signature`
3. Verify against the configured risk oracle address

The current demo uses deterministic signing to avoid external dependencies while maintaining the same verification logic.

## Troubleshooting

### Common Issues

1. **"Start time must be in the future"**: Use a future timestamp for `--asof`
2. **"Unauthorized"**: Ensure deployer has BROKER_ROLE
3. **"Invalid quote signature"**: Check that quote matches expected format

### Debug Mode

Add `--verbose` flag for detailed logging:
```bash
yarn hardhat swap:demo --obligor ACME-LLC --tenor 30 --asof 1600000000 --notional 1000000 --fixed-spread 80 --verbose
```

## Next Steps

- Integrate with live Pricing Service
- Add token transfer logic
- Implement portfolio management
- Add risk limits and validation

