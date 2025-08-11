# BRICS Pricing Service v0.1

Deterministic stub that signs risk outputs for on-chain verification.

## Setup

```bash
pip install -r requirements.txt
export ORACLE_PRIVATE_KEY=0x…   # optional; else ephemeral key
```

## Run

```bash
uvicorn app:app --reload --port 8001
```

## Example

```bash
curl -s localhost:8001/v1/price -H 'content-type: application/json' -d '{
  "portfolioId":"0x1111111111111111111111111111111111111111111111111111111111111111",
  "asOf":1700000000,
  "modelId":"xgb-v0-stub",
  "features":{"sector":"sme","meanPD":0.03,"sigmaPD":0.12}
}' | jq
```

Outputs: `{ riskScore, correlationBps, spreadBps, digest, signature, ... }`.

## Testing

```bash
pytest tests/
```

## Hashing Specification

The service signs the digest:

```
digest = keccak256( abi.encode(
  bytes32 portfolioId,        // 0x… (32 bytes)
  uint64  asOf,               // unix seconds
  uint256 riskScore,          // 0..2^256-1 (keep < 1e27 for sanity)
  uint16  correlationBps,     // 0..10000
  uint16  spreadBps,          // 0..20000
  bytes32 modelIdHash,        // keccak256(modelId string)
  bytes32 featuresHash        // keccak256 of canonicalized features blob
))
```

- **Canonicalization**: features (arbitrary JSON) → UTF-8 bytes of `json.dumps(features, separators=(',', ':'), sort_keys=True)`, then `featuresHash=keccak256(bytes)`
- **modelIdHash** = `keccak256(modelId.encode('utf-8'))`
- **Signature**: ECDSA over digest with secp256k1 (no prefix, no EIP-191/712 for v0.1)
- **Solidity verification**: `ECDSA.recover(digest, signature)` compared to `riskOracle`

This keeps off-chain/on-chain hashing 1:1 with `abi.encode`.
