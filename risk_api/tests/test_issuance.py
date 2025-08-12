"""
BRICS Risk API - Issuance endpoint tests.

Tests for the issuance state endpoint with signature verification.
"""

import pytest
from fastapi.testclient import TestClient

from risk_api.signing import SigningKey


def test_issuance_state_response(test_client: TestClient) -> None:
    """Test issuance state endpoint returns correct data."""
    response = test_client.get("/api/v1/issuance/state")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["locked", "cap_tokens", "detach_bps", "ratify_until", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["locked"], int)
    assert isinstance(data["cap_tokens"], int)
    assert isinstance(data["detach_bps"], int)
    assert isinstance(data["ratify_until"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["locked"] in [0, 1]
    assert data["cap_tokens"] > 0
    assert data["detach_bps"] >= 10000  # 100% minimum
    assert data["ratify_until"] >= 0
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_issuance_state_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test issuance state signature is valid."""
    response = test_client.get("/api/v1/issuance/state")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    issuance_data = {
        "locked": data["locked"],
        "cap_tokens": data["cap_tokens"],
        "detach_bps": data["detach_bps"],
        "ratify_until": data["ratify_until"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(issuance_data, data["sig"])


def test_issuance_state_schema(test_client: TestClient) -> None:
    """Test issuance state response schema."""
    response = test_client.get("/api/v1/issuance/state")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all fields are present and have correct types
    assert isinstance(data["locked"], int)
    assert isinstance(data["cap_tokens"], int)
    assert isinstance(data["detach_bps"], int)
    assert isinstance(data["ratify_until"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
