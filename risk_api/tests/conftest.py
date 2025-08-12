"""
BRICS Risk API - Test configuration and fixtures.

Provides test client, ephemeral signing key, and provider overrides for testing.
"""

import os
import pytest
from fastapi.testclient import TestClient

from risk_api.app import app
from risk_api.signing import SigningKey


@pytest.fixture
def test_signing_key() -> SigningKey:
    """Create ephemeral signing key for testing."""
    # Use a deterministic test key (64 hex characters = 32 bytes)
    test_secret = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    return SigningKey(test_secret)


@pytest.fixture
def test_client(test_signing_key: SigningKey) -> TestClient:
    """Create test client with ephemeral signing key."""
    # Set environment variable for the test
    os.environ["RISK_API_ED25519_SK_HEX"] = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    
    with TestClient(app) as client:
        yield client
    
    # Clean up
    if "RISK_API_ED25519_SK_HEX" in os.environ:
        del os.environ["RISK_API_ED25519_SK_HEX"]


@pytest.fixture
def sample_nav_data() -> dict:
    """Sample NAV data for testing."""
    return {
        "nav_ray": 1000000000000000000000000000,
        "model_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "emergency_nav_ray": 1000000000000000000000000000,
        "emergency_enabled": 0,
        "ts": 1640995200,
    }


@pytest.fixture
def sample_emergency_data() -> dict:
    """Sample emergency data for testing."""
    return {
        "level": 0,
        "reason": "normal",
        "ts": 1640995200,
    }


@pytest.fixture
def sample_issuance_data() -> dict:
    """Sample issuance data for testing."""
    return {
        "locked": 0,
        "cap_tokens": 4440000000000000000000000,
        "detach_bps": 10200,
        "ratify_until": 0,
        "ts": 1640995200,
    }


@pytest.fixture
def sample_risk_data() -> dict:
    """Sample risk data for testing."""
    return {
        "defaults_bps": 300,
        "sovereign_usage_bps": 0,
        "correlation_bps": 250,
        "ts": 1640995200,
    }
