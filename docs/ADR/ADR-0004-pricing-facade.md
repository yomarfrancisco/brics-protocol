# ADR-0004: Pricing Facade with Bank Data Feature Flag

## Status
Accepted

## Context
The CDS Swap Module needs to integrate with external pricing services while maintaining:
- Deterministic CI behavior (no external network calls)
- Safe development practices (bank data off by default)
- Flexible deployment options (stub → fastapi → bank)
- Clear separation of concerns

## Decision
Implement a pricing facade with provider abstraction and bank data feature flags.

## Architecture

### Provider Interface
```typescript
interface PricingProvider {
  price(input: QuoteInput): Promise<QuoteOut>;
}
```

### Provider Matrix
| Provider | Use Case | Network Calls | Bank Data |
|----------|----------|---------------|-----------|
| `stub` | CI, testing | ❌ | ❌ |
| `fastapi` | Local dev, staging | ✅ (local) | ❌ |
| `replay` | Dev parity, debugging, CI E2E | ❌ | ❌ |
| `bank` | Production | ✅ | ✅ (when enabled) |

### Environment Flags
```bash
# Provider selection
PRICING_PROVIDER=stub|fastapi|replay|bank  # default: stub

# Bank data control
BANK_DATA_MODE=off|record|replay|live      # default: off

# Service URLs
PRICING_URL=http://127.0.0.1:8001         # when fastapi
PRICING_FIXTURES_DIR=pricing-fixtures     # when replay
```

## Implementation

### Provider Factory
```typescript
export function makePricingProvider(): PricingProvider {
  switch (PROVIDER) {
    case "fastapi": return new PricingProviderFastAPI();
    case "replay":  return new PricingProviderRecordReplay();
    case "bank":    return new PricingProviderBank();
    case "stub":
    default:        return new PricingProviderStub();
  }
}
```

### Bank Switch Behavior
- **Bank Provider**: Throws unless `BANK_DATA_MODE=live`
- **Default**: All environments start with bank data disabled
- **Explicit Opt-in**: Production must explicitly enable bank data

### Deterministic Stub
```typescript
// Deterministic "golden" response
const h = crypto.createHash("sha256")
  .update(JSON.stringify({ p: input.portfolioId, t: input.tenorDays, a: input.asOf }))
  .digest();
const fair = 25 + (h[0] % 100);          // 25..124 bps
const corr = 1000 + (h[1] % 8000);       // 10%..90%
```

## Consequences

### Positive
- **CI Safety**: No external calls in CI by default
- **Dev Flexibility**: Easy switching between providers
- **Bank Safety**: Explicit opt-in for bank data
- **Deterministic**: Reproducible test results
- **Parity**: Record/replay for dev consistency

### Negative
- **Complexity**: Additional abstraction layer
- **Configuration**: More environment variables
- **Testing**: Need to test all provider paths

### Risks
- **Misconfiguration**: Wrong provider in production
- **Bank Data Leak**: Accidental bank data access
- **Signature Mismatch**: Provider vs on-chain verification

## Mitigations
- **Default Safety**: Bank data off by default
- **CI Guards**: Required jobs use stub provider
- **Signature Parity**: Same verification logic across providers
- **Clear Documentation**: Provider matrix and usage examples
- **Replay E2E**: Deterministic CI job uses replay provider with fixture checksums

## Migration
1. **Phase 1**: Implement facade with stub provider
2. **Phase 2**: Add fastapi provider for local dev
3. **Phase 3**: Add record/replay for dev parity
4. **Phase 4**: Add bank provider (disabled by default)

## Related
- ADR-0001: Adaptive Tranching v0.1
- RiskSignalLib signature verification
- CDS Swap settlement logic
