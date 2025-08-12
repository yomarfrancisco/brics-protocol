"""
BRICS Risk API - Health endpoint tests.

Tests for the health check endpoint.
"""

import pytest
from fastapi.testclient import TestClient


def test_health_check(test_client: TestClient) -> None:
    """Test health check endpoint returns correct status."""
    response = test_client.get("/api/v1/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "ok"
    assert "ts" in data
    assert isinstance(data["ts"], int)
    assert data["ts"] > 0


def test_health_check_schema(test_client: TestClient) -> None:
    """Test health check response schema."""
    response = test_client.get("/api/v1/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check all required fields
    required_fields = ["status", "ts"]
    for field in required_fields:
        assert field in data
    
    # Check field types
    assert isinstance(data["status"], str)
    assert isinstance(data["ts"], int)
