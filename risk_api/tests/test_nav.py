"""
BRICS Risk API - NAV endpoint tests.

Tests for the NAV latest endpoint with signature verification.
"""

import pytest
from fastapi.testclient import TestClient

from risk_api.signing import SigningKey


def test_nav_latest_response(test_client: TestClient) -> None:
    """Test NAV latest endpoint returns correct data."""
    response = test_client.get("/api/v1/nav/latest")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["nav_ray", "model_hash", "emergency_nav_ray", "emergency_enabled", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["nav_ray"], int)
    assert isinstance(data["model_hash"], str)
    assert isinstance(data["emergency_nav_ray"], int)
    assert isinstance(data["emergency_enabled"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["nav_ray"] > 0
    assert data["model_hash"].startswith("0x")
    assert data["emergency_nav_ray"] > 0
    assert data["emergency_enabled"] in [0, 1]
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_nav_latest_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test NAV latest signature is valid."""
    response = test_client.get("/api/v1/nav/latest")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    nav_data = {
        "nav_ray": data["nav_ray"],
        "model_hash": data["model_hash"],
        "emergency_nav_ray": data["emergency_nav_ray"],
        "emergency_enabled": data["emergency_enabled"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(nav_data, data["sig"])


def test_nav_latest_schema(test_client: TestClient) -> None:
    """Test NAV latest response schema."""
    response = test_client.get("/api/v1/nav/latest")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all fields are present and have correct types
    assert isinstance(data["nav_ray"], int)
    assert isinstance(data["model_hash"], str)
    assert isinstance(data["emergency_nav_ray"], int)
    assert isinstance(data["emergency_enabled"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
