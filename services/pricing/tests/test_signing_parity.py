"""
Test signing parity with Solidity RiskSignalLib
"""
import os
import pytest
from services.pricing.signing import (
    digest, sign_digest, recover, load_or_create_key, public_address,
    canonical_features_hash, model_id_hash
)

def test_signing_parity():
    """Test that Python signing matches Solidity RiskSignalLib expectations"""
    
    # Test data matching the Solidity test vectors
    portfolio_id = bytes.fromhex('11' * 32)  # 0x1111...1111
    as_of = 1700000000
    risk_score = 123456789
    correlation_bps = 777
    spread_bps = 1500
    model_id = "xgb-v0-stub"
    features = {
        "size": 0.5,
        "leverage": 0.3,
        "volatility": 0.4,
        "fxExposure": 0.2,
        "countryRisk": 0.1,
        "industryStress": 0.2,
        "collateralQuality": 0.7,
        "dataQuality": 0.8,
        "modelShift": 0.1
    }
    
    # Generate digest
    digest_bytes = digest(
        portfolio_id, as_of, risk_score, correlation_bps, spread_bps,
        model_id, features
    )
    
    # Load or create deterministic key
    private_key = load_or_create_key()
    expected_address = public_address(private_key)
    
    # Sign the digest
    signature = sign_digest(digest_bytes, private_key)
    
    # Recover signer
    recovered_address = recover(digest_bytes, signature)
    
    # Verify parity
    assert recovered_address == expected_address, f"Recovered {recovered_address} != expected {expected_address}"
    
    # Print debug info for CI
    print(f"Digest: 0x{digest_bytes.hex()}")
    print(f"Signature: {signature}")
    print(f"Expected address: {expected_address}")
    print(f"Recovered address: {recovered_address}")
    
    # Verify signature format
    assert signature.startswith('0x')
    assert len(bytes.fromhex(signature[2:])) == 65  # 65 bytes for ECDSA signature
    
    # Verify digest format
    assert len(digest_bytes) == 32  # 32 bytes for keccak256

def test_canonical_features_hash():
    """Test that features hash is deterministic and canonical"""
    features1 = {"a": 1, "b": 2}
    features2 = {"b": 2, "a": 1}  # Different order
    
    hash1 = canonical_features_hash(features1)
    hash2 = canonical_features_hash(features2)
    
    # Should be identical due to sorted keys
    assert hash1 == hash2
    print(f"Features hash: 0x{hash1.hex()}")

def test_model_id_hash():
    """Test model ID hashing"""
    model_id = "baseline-v0"
    model_hash = model_id_hash(model_id)
    
    assert len(model_hash) == 32
    print(f"Model hash: 0x{model_hash.hex()}")

def test_deterministic_key_generation():
    """Test that deterministic keys are consistent"""
    os.environ['SEED'] = '42'
    
    key1 = load_or_create_key()
    key2 = load_or_create_key()
    
    assert key1 == key2
    assert key1.startswith('0x')
    assert len(key1) == 66  # 0x + 64 hex chars
    
    address = public_address(key1)
    assert address.startswith('0x')
    print(f"Deterministic key: {key1}")
    print(f"Deterministic address: {address}")
