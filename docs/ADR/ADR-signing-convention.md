# ADR-0002: Signing Convention for BRICS Pricing Service

## Status

Accepted

## Context

The BRICS Pricing Service needs to generate cryptographically signed risk signals that can be verified on-chain. The signing mechanism must be deterministic, secure, and compatible with Ethereum's EIP-191 standard.

## Decision

We will use EIP-191 compatible signatures with a specific digest format that matches the on-chain `RiskSignalLib.digest()` function.

## Consequences

### Positive
- **On-chain verification**: Signatures can be verified directly in Solidity contracts
- **Deterministic**: Same inputs always produce the same signature
- **Standard compliant**: Uses widely-adopted EIP-191 standard
- **Secure**: Cryptographic signatures prevent tampering

### Negative
- **Complexity**: Requires careful field ordering and type matching
- **Testing overhead**: Need to verify parity between Python and Solidity

## Technical Specification

### Digest Format

The digest is generated using the following field order and types, matching `RiskSignalLib.digest()`:

```solidity
// Field order in RiskSignalLib.Payload
struct Payload {
    bytes32 portfolio_id;    // Portfolio identifier
    uint64 as_of;           // Timestamp
    uint256 risk_score;     // Risk score in basis points
    uint16 correlation_bps; // Correlation in basis points
    uint16 spread_bps;      // Fair spread in basis points
    bytes32 model_id_hash;  // keccak256(model_id)
    bytes32 features_hash;  // keccak256(canonical JSON)
}
```

### Python Implementation

```python
def encode_payload(portfolio_id: bytes, as_of: int, risk_score: int,
                  correlation_bps: int, spread_bps: int, model_id_hash: bytes,
                  features_hash: bytes) -> bytes:
    """Encode payload exactly like RiskSignalLib.digest()"""
    encoded = encode(
        ['bytes32', 'uint64', 'uint256', 'uint16', 'uint16', 'bytes32', 'bytes32'],
        [portfolio_id, as_of, risk_score, correlation_bps, spread_bps, model_id_hash, features_hash]
    )
    return keccak(encoded)
```

### Canonical Feature Hashing

Features are hashed using canonical JSON (sorted keys):

```python
def canonical_features_hash(features: Dict[str, Any]) -> bytes:
    """Generate canonical hash of features dict (sorted keys)"""
    canonical = json.dumps(features, sort_keys=True, separators=(',', ':'))
    return keccak(to_bytes(text=canonical))
```

### Model ID Hashing

Model IDs are hashed using keccak256:

```python
def model_id_hash(model_id: str) -> bytes:
    """Generate keccak256 hash of model ID string"""
    return keccak(to_bytes(text=model_id))
```

### Signing Process

1. **Generate digest**: Use `encode_payload()` with exact field order
2. **Sign digest**: Use `eth_keys` for direct signing (no EIP-191 prefix)
3. **EIP-191 prefix**: Applied in Solidity during verification

### Signature Recovery

```python
def recover(digest: bytes, signature: str) -> str:
    """Recover signer address from signature"""
    from eth_keys import keys
    sig = keys.Signature(bytes.fromhex(signature[2:]))
    public_key = sig.recover_public_key_from_msg_hash(digest)
    return public_key.to_checksum_address()
```

### On-chain Verification

In Solidity, the signature is verified using:

```solidity
// Apply EIP-191 prefix
bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(digest);

// Recover signer
address signer = ECDSA.recover(ethSignedMessageHash, signature);

// Verify signer
require(signer == RISK_ORACLE_ADDRESS, "Invalid signer");
```

## Field Validation

### Risk Score
- **Type**: `uint256`
- **Range**: 0 to 2^256 - 1
- **Calculation**: `round_half_up(EL_bps)` where EL_bps = (pdBps * lgdBps) / 10000

### Correlation BPS
- **Type**: `uint16`
- **Range**: 1000 to 9000
- **Calculation**: `clamp(round_half_up((15 + 2.5*volatility + 1.5*countryRisk) * 100), 1000, 9000)`

### Spread BPS
- **Type**: `uint16`
- **Range**: 25 to 3000
- **Calculation**: `clamp(round_half_up(EL_bps + liq_bps + rp_bps), 25, 3000)`

### Timestamp
- **Type**: `uint64`
- **Range**: 0 to 2^64 - 1
- **Format**: Unix timestamp in seconds

## Testing Requirements

### Parity Testing
Every signature must pass parity testing:

```python
def test_signing_parity():
    # Generate signature
    digest = encode_payload(...)
    signature = sign_digest(digest, private_key)
    
    # Recover signer
    recovered = recover(digest, signature)
    
    # Verify parity
    assert recovered == expected_address
```

### Golden Vector Validation
Use Golden Vector A for deterministic testing:

```bash
MODEL_JITTER_BPS_OVERRIDE=0 SEED="" python -m services.pricing.cli price \
  --obligor ACME-LLC --tenor 365 --asof 1726000000 --notional 1000000 \
  --features '{"size":1.2,"leverage":0.5,"volatility":0.3,"fxExposure":0.1,"countryRisk":0.2,"industryStress":0.4,"collateralQuality":0.7,"dataQuality":0.8,"modelShift":0.1}' \
  --json-only
```

Expected output includes:
- `digest`: "0x9e69b1a966860b8fd21c3fac94dca845be6199856bb4112bd781220389e2eae7"
- `signature`: "0x00821d1cefada45de05be0fb815a5a45f1183f1070f318e4f7bc269d32123eaa28b34c9e6c80459e4023cf7cd52ecc3b02283fc5030d71a30d1d139c06b2354e01"
- `signer`: "0xae3DfFEE97f92db0201d11CB8877C89738353bCE"

## Security Considerations

1. **Private Key Management**: Private keys must be securely stored and never exposed
2. **Deterministic Generation**: For testing, use deterministic key generation from SEED
3. **Field Validation**: All fields must be validated before signing
4. **Replay Protection**: Timestamps provide basic replay protection
5. **Signature Verification**: Always verify recovered address matches expected

## Implementation Notes

- Use `eth_keys` for direct signing without EIP-191 prefix
- Apply EIP-191 prefix only in Solidity verification
- Ensure exact field order and type matching
- Test parity between Python and Solidity implementations
- Use Golden Vector A for deterministic validation
