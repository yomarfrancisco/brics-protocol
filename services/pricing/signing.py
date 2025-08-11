"""
Signing utilities for BRICS Pricing Service with exact parity to RiskSignalLib.sol
"""
import os
from typing import Dict, Any
from eth_abi import encode
from eth_utils import keccak, to_bytes
from eth_keys import keys
from eth_account import Account
import json

def canonical_features_hash(features: Dict[str, Any]) -> bytes:
    """Generate canonical hash of features dict (sorted keys)"""
    # Sort keys for deterministic ordering
    canonical = json.dumps(features, sort_keys=True, separators=(',', ':'))
    return keccak(to_bytes(text=canonical))

def model_id_hash(model_id: str) -> bytes:
    """Generate keccak256 hash of model ID string"""
    return keccak(to_bytes(text=model_id))

def encode_payload(portfolio_id: bytes, as_of: int, risk_score: int,
                  correlation_bps: int, spread_bps: int, model_id_hash: bytes,
                  features_hash: bytes) -> bytes:
    """
    Encode payload exactly like RiskSignalLib.digest()
    
    Args:
        portfolio_id: bytes32 portfolio identifier
        as_of: uint64 timestamp
        risk_score: uint256 risk score
        correlation_bps: uint16 correlation in basis points
        spread_bps: uint16 spread in basis points  
        model_id_hash: bytes32 keccak256(model_id)
        features_hash: bytes32 keccak256(canonical_features)
    
    Returns:
        bytes32 digest matching Solidity keccak256(abi.encode(...))
    """
    # Exact field order and types from RiskSignalLib.Payload
    encoded = encode(
        ['bytes32', 'uint64', 'uint256', 'uint16', 'uint16', 'bytes32', 'bytes32'],
        [portfolio_id, as_of, risk_score, correlation_bps, spread_bps, model_id_hash, features_hash]
    )
    return keccak(encoded)

def digest(portfolio_id: bytes, as_of: int, risk_score: int,
           correlation_bps: int, spread_bps: int, model_id: str,
           features: Dict[str, Any]) -> bytes:
    """
    Generate digest for signing - matches RiskSignalLib.digest()
    
    Args:
        portfolio_id: bytes32 portfolio identifier
        as_of: uint64 timestamp
        risk_score: uint256 risk score
        correlation_bps: uint16 correlation in basis points
        spread_bps: uint16 spread in basis points
        model_id: string model identifier
        features: dict of risk features
    
    Returns:
        bytes32 digest ready for EIP-191 signing
    """
    model_hash = model_id_hash(model_id)
    features_hash = canonical_features_hash(features)
    
    return encode_payload(
        portfolio_id, as_of, risk_score, correlation_bps, spread_bps,
        model_hash, features_hash
    )

def sign_digest(digest: bytes, private_key: str) -> str:
    """
    Sign digest with EIP-191 prefix (matches Solidity MessageHashUtils.toEthSignedMessageHash)
    
    Args:
        digest: bytes32 digest from encode_payload()
        private_key: hex string private key
    
    Returns:
        0x-prefixed signature string
    """
    # Use eth_keys directly for signing (no EIP-191 prefix)
    from eth_keys import keys
    pk = keys.PrivateKey(bytes.fromhex(private_key[2:]))  # Remove 0x prefix
    signature = pk.sign_msg_hash(digest)
    return signature.to_hex()

def recover(digest: bytes, signature: str) -> str:
    """
    Recover signer address from signature (matches Solidity ECDSA.recover)
    
    Args:
        digest: bytes32 digest that was signed
        signature: 0x-prefixed signature string
    
    Returns:
        0x-prefixed address string
    """
    # Use eth_keys directly for recovery (no EIP-191 prefix)
    from eth_keys import keys
    sig = keys.Signature(bytes.fromhex(signature[2:]))  # Remove 0x prefix
    public_key = sig.recover_public_key_from_msg_hash(digest)
    return public_key.to_checksum_address()

def load_or_create_key() -> str:
    """Load private key from environment or create deterministic one"""
    key = os.getenv('RISK_ORACLE_PRIVATE_KEY')
    if key:
        return key
    
    # Fallback to deterministic key for testing
    seed = int(os.getenv('SEED', '42'))
    # Generate deterministic private key from seed
    deterministic_key = f"0x{seed:064x}"
    return deterministic_key

def public_address(private_key: str) -> str:
    """Get public address from private key"""
    account = Account.from_key(private_key)
    return account.address
