"""
BRICS Risk API - Safety endpoint tests.

Tests for the lane pre-trade check and NAV sanity check endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from risk_api.signing import SigningKey


def test_lane_pretrade_response(test_client: TestClient) -> None:
    """Test lane pre-trade endpoint returns correct data."""
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10000&emergency_level=0")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["ok", "min_bps", "max_bps", "price_bps", "emergency_level", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["ok"], int)
    assert isinstance(data["min_bps"], int)
    assert isinstance(data["max_bps"], int)
    assert isinstance(data["price_bps"], int)
    assert isinstance(data["emergency_level"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["ok"] in [0, 1]
    assert data["min_bps"] > 0
    assert data["max_bps"] > data["min_bps"]
    assert data["price_bps"] == 10000
    assert data["emergency_level"] == 0
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_lane_pretrade_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test lane pre-trade signature is valid."""
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10000&emergency_level=0")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    pretrade_data = {
        "ok": data["ok"],
        "min_bps": data["min_bps"],
        "max_bps": data["max_bps"],
        "price_bps": data["price_bps"],
        "emergency_level": data["emergency_level"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(pretrade_data, data["sig"])


def test_lane_pretrade_level_0_bounds(test_client: TestClient) -> None:
    """Test lane pre-trade with level 0 bounds (9800-10200)."""
    # Test within bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10000&emergency_level=0")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1
    assert data["min_bps"] == 9800
    assert data["max_bps"] == 10200
    
    # Test below bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=9700&emergency_level=0")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0
    
    # Test above bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10300&emergency_level=0")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0


def test_lane_pretrade_level_1_bounds(test_client: TestClient) -> None:
    """Test lane pre-trade with level 1 bounds (9900-10100)."""
    # Test within bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10000&emergency_level=1")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1
    assert data["min_bps"] == 9900
    assert data["max_bps"] == 10100
    
    # Test outside bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10200&emergency_level=1")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0


def test_lane_pretrade_level_2_bounds(test_client: TestClient) -> None:
    """Test lane pre-trade with level 2 bounds (9975-10025)."""
    # Test within bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10000&emergency_level=2")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1
    assert data["min_bps"] == 9975
    assert data["max_bps"] == 10025
    
    # Test outside bounds
    response = test_client.get("/api/v1/lane/pretrade?price_bps=10050&emergency_level=2")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0


def test_nav_sanity_response(test_client: TestClient) -> None:
    """Test NAV sanity endpoint returns correct data."""
    response = test_client.get("/api/v1/oracle/nav-sanity?proposed_nav_ray=1000000000000000000000000000")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = ["ok", "prev_nav_ray", "proposed_nav_ray", "max_jump_bps", "emergency_enabled", "assumed_prev", "ts", "sig"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["ok"], int)
    assert isinstance(data["prev_nav_ray"], int)
    assert isinstance(data["proposed_nav_ray"], int)
    assert isinstance(data["max_jump_bps"], int)
    assert isinstance(data["emergency_enabled"], int)
    assert isinstance(data["assumed_prev"], int)
    assert isinstance(data["ts"], int)
    assert isinstance(data["sig"], str)
    
    # Check values are reasonable
    assert data["ok"] in [0, 1]
    assert data["prev_nav_ray"] > 0
    assert data["proposed_nav_ray"] > 0
    assert data["max_jump_bps"] > 0
    assert data["emergency_enabled"] in [0, 1]
    assert data["assumed_prev"] in [0, 1]
    assert data["ts"] > 0
    assert len(data["sig"]) == 128  # Ed25519 signature hex length


def test_nav_sanity_signature_verification(test_client: TestClient, test_signing_key: SigningKey) -> None:
    """Test NAV sanity signature is valid."""
    response = test_client.get("/api/v1/oracle/nav-sanity?proposed_nav_ray=1000000000000000000000000000")
    
    assert response.status_code == 200
    data = response.json()
    
    # Extract data without signature for verification
    nav_sanity_data = {
        "ok": data["ok"],
        "prev_nav_ray": data["prev_nav_ray"],
        "proposed_nav_ray": data["proposed_nav_ray"],
        "max_jump_bps": data["max_jump_bps"],
        "emergency_enabled": data["emergency_enabled"],
        "assumed_prev": data["assumed_prev"],
        "ts": data["ts"],
    }
    
    # Verify signature
    assert test_signing_key.verify(nav_sanity_data, data["sig"])


def test_nav_sanity_within_bounds(test_client: TestClient) -> None:
    """Test NAV sanity with price within bounds."""
    prev_nav = 1000000000000000000000000000  # 1.0 RAY
    proposed_nav = 1020000000000000000000000000  # 1.02 RAY (2% increase)
    
    response = test_client.get(f"/api/v1/oracle/nav-sanity?prev_nav_ray={prev_nav}&proposed_nav_ray={proposed_nav}&max_jump_bps=500")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1
    assert data["assumed_prev"] == 0


def test_nav_sanity_outside_bounds(test_client: TestClient) -> None:
    """Test NAV sanity with price outside bounds."""
    prev_nav = 1000000000000000000000000000  # 1.0 RAY
    proposed_nav = 1100000000000000000000000000  # 1.10 RAY (10% increase)
    
    response = test_client.get(f"/api/v1/oracle/nav-sanity?prev_nav_ray={prev_nav}&proposed_nav_ray={proposed_nav}&max_jump_bps=500")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0
    assert data["assumed_prev"] == 0


def test_nav_sanity_emergency_enabled(test_client: TestClient) -> None:
    """Test NAV sanity with emergency mode enabled."""
    prev_nav = 1000000000000000000000000000  # 1.0 RAY
    proposed_nav = 1100000000000000000000000000  # 1.10 RAY (10% increase)
    
    response = test_client.get(f"/api/v1/oracle/nav-sanity?prev_nav_ray={prev_nav}&proposed_nav_ray={proposed_nav}&max_jump_bps=500&emergency=1")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1  # Should be allowed with emergency enabled
    assert data["emergency_enabled"] == 1


def test_nav_sanity_assumed_prev(test_client: TestClient) -> None:
    """Test NAV sanity with assumed previous NAV."""
    proposed_nav = 1000000000000000000000000000  # 1.0 RAY
    
    response = test_client.get(f"/api/v1/oracle/nav-sanity?proposed_nav_ray={proposed_nav}")
    assert response.status_code == 200
    data = response.json()
    assert data["assumed_prev"] == 1  # Should indicate assumed previous NAV
    assert data["prev_nav_ray"] == 1000000000000000000000000000  # Default 1.0 RAY


def test_nav_sanity_custom_max_jump(test_client: TestClient) -> None:
    """Test NAV sanity with custom max jump setting."""
    prev_nav = 1000000000000000000000000000  # 1.0 RAY
    proposed_nav = 1030000000000000000000000000  # 1.03 RAY (3% increase)
    
    # With default 500 bps (5%), should be allowed
    response = test_client.get(f"/api/v1/oracle/nav-sanity?prev_nav_ray={prev_nav}&proposed_nav_ray={proposed_nav}")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 1
    
    # With custom 200 bps (2%), should be rejected
    response = test_client.get(f"/api/v1/oracle/nav-sanity?prev_nav_ray={prev_nav}&proposed_nav_ray={proposed_nav}&max_jump_bps=200")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] == 0

