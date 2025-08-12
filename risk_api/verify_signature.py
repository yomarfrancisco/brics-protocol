#!/usr/bin/env python3
"""
BRICS Risk API - Signature verification example.

Demonstrates how to verify Ed25519 signatures from the API responses.
"""

import json
import sys
from typing import Dict, Any

import requests
from nacl.signing import VerifyKey


def verify_signature(data: Dict[str, Any], signature_hex: str, public_key_hex: str) -> bool:
    """Verify Ed25519 signature of canonical JSON data.
    
    Args:
        data: Data dictionary (without signature)
        signature_hex: Hex-encoded signature
        public_key_hex: Hex-encoded public key
        
    Returns:
        True if signature is valid, False otherwise
    """
    try:
        # Create verify key
        verify_key = VerifyKey(bytes.fromhex(public_key_hex))
        
        # Create canonical JSON (same as in signing.py)
        canonical_obj = {}
        for key in sorted(data.keys()):
            value = data[key]
            if isinstance(value, float):
                canonical_obj[key] = int(value)
            else:
                canonical_obj[key] = value
        
        canonical_bytes = json.dumps(canonical_obj, separators=(',', ':'), sort_keys=True).encode('utf-8')
        
        # Verify signature
        signature_bytes = bytes.fromhex(signature_hex)
        verify_key.verify(canonical_bytes, signature_bytes)
        return True
    except Exception as e:
        print(f"Signature verification failed: {e}")
        return False


def main():
    """Main function to demonstrate signature verification."""
    base_url = "http://localhost:8000"
    
    # Get public key
    try:
        pubkey_response = requests.get(f"{base_url}/.well-known/risk-api-pubkey")
        pubkey_response.raise_for_status()
        public_key = pubkey_response.json()["ed25519_pubkey_hex"]
        print(f"Public key: {public_key}")
    except Exception as e:
        print(f"Failed to get public key: {e}")
        return 1
    
    # Test NAV endpoint
    try:
        nav_response = requests.get(f"{base_url}/api/v1/nav/latest")
        nav_response.raise_for_status()
        nav_data = nav_response.json()
        
        print(f"\nNAV Response:")
        print(json.dumps(nav_data, indent=2))
        
        # Extract data without signature
        nav_data_unsigned = {
            "nav_ray": nav_data["nav_ray"],
            "model_hash": nav_data["model_hash"],
            "emergency_nav_ray": nav_data["emergency_nav_ray"],
            "emergency_enabled": nav_data["emergency_enabled"],
            "ts": nav_data["ts"],
        }
        
        # Verify signature
        is_valid = verify_signature(nav_data_unsigned, nav_data["sig"], public_key)
        print(f"\nSignature verification: {'✓ VALID' if is_valid else '✗ INVALID'}")
        
    except Exception as e:
        print(f"Failed to test NAV endpoint: {e}")
        return 1
    
    # Test Risk endpoint
    try:
        risk_response = requests.get(f"{base_url}/api/v1/risk/summary")
        risk_response.raise_for_status()
        risk_data = risk_response.json()
        
        print(f"\nRisk Response:")
        print(json.dumps(risk_data, indent=2))
        
        # Extract data without signature
        risk_data_unsigned = {
            "defaults_bps": risk_data["defaults_bps"],
            "sovereign_usage_bps": risk_data["sovereign_usage_bps"],
            "correlation_bps": risk_data["correlation_bps"],
            "ts": risk_data["ts"],
        }
        
        # Verify signature
        is_valid = verify_signature(risk_data_unsigned, risk_data["sig"], public_key)
        print(f"\nSignature verification: {'✓ VALID' if is_valid else '✗ INVALID'}")
        
    except Exception as e:
        print(f"Failed to test Risk endpoint: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
