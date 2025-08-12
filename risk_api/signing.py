"""
BRICS Risk API - Deterministic Ed25519 signing for aggregate feeds.

Provides canonical JSON serialization and Ed25519 signature generation/verification
for all API responses to ensure data integrity and authenticity.
"""

import json
import os
from typing import Any, Dict

import nacl.signing


class SigningKey:
    """Ed25519 signing key manager for deterministic API response signing."""

    def __init__(self, secret_key_hex: str) -> None:
        """Initialize signing key from hex-encoded secret key.
        
        Args:
            secret_key_hex: 64-character hex string representing Ed25519 secret key
        """
        if len(secret_key_hex) != 64:
            raise ValueError(f"Secret key must be 64 hex characters, got {len(secret_key_hex)}")
        
        try:
            secret_key_bytes = bytes.fromhex(secret_key_hex)
            self._signing_key = nacl.signing.SigningKey(secret_key_bytes)
            self._verify_key = self._signing_key.verify_key
        except Exception as e:
            raise ValueError(f"Invalid Ed25519 secret key: {e}")

    def public_key_hex(self) -> str:
        """Get hex-encoded public key for verification."""
        return self._verify_key.encode().hex()

    def sign(self, data: Dict[str, Any]) -> str:
        """Sign canonical JSON representation of data.
        
        Args:
            data: Dictionary to sign (will be canonicalized)
            
        Returns:
            Hex-encoded Ed25519 signature
        """
        canonical_bytes = canonical_json(data)
        signature = self._signing_key.sign(canonical_bytes)
        return signature.signature.hex()

    def verify(self, data: Dict[str, Any], signature_hex: str) -> bool:
        """Verify signature against canonical JSON representation.
        
        Args:
            data: Original data dictionary
            signature_hex: Hex-encoded signature to verify
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            signature_bytes = bytes.fromhex(signature_hex)
            canonical_bytes = canonical_json(data)
            self._verify_key.verify(canonical_bytes, signature_bytes)
            return True
        except Exception:
            return False


def canonical_json(obj: Dict[str, Any]) -> bytes:
    """Generate canonical JSON representation for deterministic signing.
    
    Canonical form:
    - Sorted keys
    - No whitespace
    - Integers only (no floats)
    - Timestamps in Unix seconds
    
    Args:
        obj: Dictionary to canonicalize
        
    Returns:
        Canonical JSON bytes
    """
    # Ensure all values are JSON-serializable and integers
    canonical_obj = {}
    for key in sorted(obj.keys()):
        value = obj[key]
        if isinstance(value, float):
            # Convert floats to integers (timestamps)
            canonical_obj[key] = int(value)
        else:
            canonical_obj[key] = value
    
    # Serialize with no whitespace and sorted keys
    return json.dumps(canonical_obj, separators=(',', ':'), sort_keys=True).encode('utf-8')


def create_signing_key() -> SigningKey:
    """Create signing key from environment variable.
    
    Returns:
        Initialized SigningKey instance
        
    Raises:
        ValueError: If RISK_API_ED25519_SK_HEX is not set or invalid
    """
    secret_key_hex = os.getenv('RISK_API_ED25519_SK_HEX')
    if not secret_key_hex:
        raise ValueError("RISK_API_ED25519_SK_HEX environment variable is required")
    
    return SigningKey(secret_key_hex)
