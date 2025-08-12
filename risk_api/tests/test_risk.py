"""
BRICS Risk API - Risk endpoint tests.

Tests for the risk summary endpoint with signature verification.
"""

import pytest
from fastapi.testclient import TestClient

from risk_api.signing import SigningKey


def test_risk_summary_response(test_client: TestClient) -> None:
    """Test risk summary endpoint returns correct data."""
    response = test_client.get("/api/v1/risk/summary")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["defaults_bps", "sovereign_usage_bps", "correlation_bps", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["defaults_bps"], int)
    assert isinstance(data["sovereign_usage_bps"], int)
    assert isinstance(data["correlation_bps"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["defaults_bps"] >= 0
    assert data["sovereign_usage_bps"] >= 0
    assert data["correlation_bps"] >= 0
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_risk_summary_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test risk summary signature is valid."""
    response = test_client.get("/api/v1/risk/summary")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    risk_data = {
        "defaults_bps": data["defaults_bps"],
        "sovereign_usage_bps": data["sovereign_usage_bps"],
        "correlation_bps": data["correlation_bps"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(risk_data, data["sig"])


def test_risk_summary_schema(test_client: TestClient) -> None:
    """Test risk summary response schema."""
    response = test_client.get("/api/v1/risk/summary")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all fields are present and have correct types
    assert isinstance(data["defaults_bps"], int)
    assert isinstance(data["sovereign_usage_bps"], int)
    assert isinstance(data["correlation_bps"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
