"""
Test API determinism with exact JSON output validation
"""
import os
import json
import pytest
from fastapi.testclient import TestClient
from services.pricing.app import app

client = TestClient(app)

def test_score_api_determinism():
    """Test that /v1/score returns exact expected values"""
    # Set environment for deterministic testing
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    # Golden vector A
    request_data = {
        "obligorId": "ACME-LLC",
        "tenorDays": 365,
        "asOf": 1726000000,
        "features": {
            "size": 1.2,
            "leverage": 0.5,
            "volatility": 0.3,
            "fxExposure": 0.1,
            "countryRisk": 0.2,
            "industryStress": 0.4,
            "collateralQuality": 0.7,
            "dataQuality": 0.8,
            "modelShift": 0.1
        }
    }
    
    response = client.post("/v1/score", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Expected values from specification
    assert result["pdBps"] == 119
    assert result["lgdBps"] == 4501
    assert abs(result["scoreConfidence"] - 0.537) < 1e-9
    
    # Verify all required fields are present
    assert "obligorId" in result
    assert "tenorDays" in result
    assert "asOf" in result
    assert "pdBps" in result
    assert "lgdBps" in result
    assert "scoreConfidence" in result

def test_price_api_determinism():
    """Test that /v1/price returns exact expected values"""
    # Set environment for deterministic testing
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    # Golden vector A
    request_data = {
        "obligorId": "ACME-LLC",
        "tenorDays": 365,
        "asOf": 1726000000,
        "notional": 1000000,
        "modelId": "baseline-v0",
        "features": {
            "size": 1.2,
            "leverage": 0.5,
            "volatility": 0.3,
            "fxExposure": 0.1,
            "countryRisk": 0.2,
            "industryStress": 0.4,
            "collateralQuality": 0.7,
            "dataQuality": 0.8,
            "modelShift": 0.1
        }
    }
    
    response = client.post("/v1/price", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Expected values from specification
    assert result["fairSpreadBps"] == 72
    assert result["correlationBps"] == 1605
    
    # Verify all required fields are present
    assert "obligorId" in result
    assert "tenorDays" in result
    assert "asOf" in result
    assert "notional" in result
    assert "fairSpreadBps" in result
    assert "correlationBps" in result
    assert "digest" in result
    assert "signature" in result
    
    # Verify digest and signature format
    assert result["digest"].startswith("0x")
    assert len(result["digest"]) == 66  # 0x + 64 hex chars
    assert result["signature"].startswith("0x")
    assert len(result["signature"]) == 132  # 0x + 130 hex chars

def test_api_field_types():
    """Test that API returns correct field types"""
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    request_data = {
        "obligorId": "TEST-LLC",
        "tenorDays": 365,
        "asOf": 1726000000,
        "notional": 1000000,
        "modelId": "baseline-v0",
        "features": {
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
    }
    
    # Test score endpoint
    score_response = client.post("/v1/score", json=request_data)
    assert score_response.status_code == 200
    score_result = score_response.json()
    
    # Verify integer types for bps fields
    assert isinstance(score_result["pdBps"], int)
    assert isinstance(score_result["lgdBps"], int)
    assert isinstance(score_result["tenorDays"], int)
    assert isinstance(score_result["asOf"], int)
    
    # Verify float type for confidence
    assert isinstance(score_result["scoreConfidence"], float)
    assert 0.30 <= score_result["scoreConfidence"] <= 0.95
    
    # Test price endpoint
    price_response = client.post("/v1/price", json=request_data)
    assert price_response.status_code == 200
    price_result = price_response.json()
    
    # Verify integer types for bps fields
    assert isinstance(price_result["fairSpreadBps"], int)
    assert isinstance(price_result["correlationBps"], int)
    assert isinstance(price_result["tenorDays"], int)
    assert isinstance(price_result["asOf"], int)
    assert isinstance(price_result["notional"], int)
    
    # Verify string types for hex fields
    assert isinstance(price_result["digest"], str)
    assert isinstance(price_result["signature"], str)

def test_api_determinism_multiple_calls():
    """Test that multiple API calls return identical results"""
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    request_data = {
        "obligorId": "DETERMINISTIC-TEST",
        "tenorDays": 365,
        "asOf": 1726000000,
        "notional": 1000000,
        "modelId": "baseline-v0",
        "features": {
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
    }
    
    # First call
    response1 = client.post("/v1/price", json=request_data)
    assert response1.status_code == 200
    result1 = response1.json()
    
    # Second call
    response2 = client.post("/v1/price", json=request_data)
    assert response2.status_code == 200
    result2 = response2.json()
    
    # Results should be identical
    assert result1 == result2
    
    # Verify specific fields are identical
    assert result1["fairSpreadBps"] == result2["fairSpreadBps"]
    assert result1["correlationBps"] == result2["correlationBps"]
    assert result1["digest"] == result2["digest"]
    assert result1["signature"] == result2["signature"]
