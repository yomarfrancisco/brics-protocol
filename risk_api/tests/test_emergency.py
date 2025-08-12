"""
BRICS Risk API - Emergency endpoint tests.

Tests for the emergency level endpoint with signature verification.
"""

import pytest
from fastapi.testclient import TestClient

from risk_api.signing import SigningKey


def test_emergency_level_response(test_client: TestClient) -> None:
    """Test emergency level endpoint returns correct data."""
    response = test_client.get("/api/v1/emergency/level")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["level", "reason", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["level"], int)
    assert isinstance(data["reason"], str)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["level"] in [0, 1, 2]  # GREEN, AMBER, RED
    assert len(data["reason"]) > 0
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_emergency_level_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test emergency level signature is valid."""
    response = test_client.get("/api/v1/emergency/level")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    emergency_data = {
        "level": data["level"],
        "reason": data["reason"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(emergency_data, data["sig"])


def test_emergency_level_schema(test_client: TestClient) -> None:
    """Test emergency level response schema."""
    response = test_client.get("/api/v1/emergency/level")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all fields are present and have correct types
    assert isinstance(data["level"], int)
    assert isinstance(data["reason"], str)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
