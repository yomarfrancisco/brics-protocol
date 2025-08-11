from eth_utils import keccak, to_bytes
from eth_abi import encode
from typing import Dict, Any
import json

def canonical_features_hash(features: Dict[str, Any]) -> bytes:
    blob = json.dumps(features, separators=(',', ':'), sort_keys=True).encode('utf-8')
    return keccak(blob)

def model_id_hash(model_id: str) -> bytes:
    return keccak(text=model_id)

def compute_outputs(portfolio_id: bytes, as_of: int, features_hash: bytes) -> Dict[str, int]:
    # Deterministic stub: derive numbers from hashes; bounded to sensible ranges.
    k = keccak(portfolio_id + as_of.to_bytes(8, 'big') + features_hash)
    # Use 32 bytes as big int
    x = int.from_bytes(k, 'big')
    riskScore      = x % (10**24)            # 0 .. 1e24-1 (plenty of headroom)
    correlationBps = x % 10001               # 0..10000
    spreadBps      = 100 + (x % 1901)        # 100..2000
    return dict(riskScore=riskScore, correlationBps=correlationBps, spreadBps=spreadBps)

def digest_for_signing(portfolio_id: bytes, as_of: int, risk_score: int,
                       correlation_bps: int, spread_bps: int, model_id_hash: bytes,
                       features_hash: bytes) -> bytes:
    # abi.encode(types, values) then keccak
    encoded = encode(
        ['bytes32','uint64','uint256','uint16','uint16','bytes32','bytes32'],
        [portfolio_id, as_of, risk_score, correlation_bps, spread_bps, model_id_hash, features_hash]
    )
    return keccak(encoded)
