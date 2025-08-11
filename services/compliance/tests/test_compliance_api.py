"""
Test compliance API endpoints with deterministic validation
"""
import os
import json
import pytest
from fastapi.testclient import TestClient
from services.compliance.app import app

client = TestClient(app)

def test_health_endpoint():
    """Test the health endpoint"""
    response = client.get("/v1/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "compliance"
    assert data["provider"] == "mock"

def test_kyc_golden_vector():
    """Test KYC golden vector with deterministic output"""
    # Set environment for deterministic testing
    os.environ['SEED'] = ''
    
    request_data = {
        "subjectId": "ALPHA-001",
        "name": "John Doe",
        "dob": "1990-01-01",
        "docType": "passport",
        "docLast4": "1234"
    }
    
    response = client.post("/v1/kyc/check", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Verify golden vector output
    assert result["subjectId"] == "ALPHA-001"
    assert result["status"] == "fail"
    assert result["confidence"] == 0.26
    assert "deterministic_mock_response" in result["reasons"]
    assert "document_validation_failed" in result["reasons"]
    assert "timestamp" in result

def test_aml_golden_vector():
    """Test AML golden vector with deterministic output"""
    # Set environment for deterministic testing
    os.environ['SEED'] = ''
    
    request_data = {
        "subjectId": "ALPHA-001"
    }
    
    response = client.post("/v1/aml/screen", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Verify golden vector output
    assert result["subjectId"] == "ALPHA-001"
    assert result["status"] == "clear"
    assert result["score"] == 86
    assert "ofac" in result["lists"]
    assert "un" in result["lists"]
    assert "eu_sanctions" in result["lists"]
    assert "timestamp" in result

def test_kyc_determinism():
    """Test that KYC responses are deterministic"""
    os.environ['SEED'] = '42'
    
    request_data = {
        "subjectId": "TEST-001",
        "name": "Jane Smith",
        "dob": "1985-05-15",
        "docType": "drivers_license",
        "docLast4": "5678"
    }
    
    # First call
    response1 = client.post("/v1/kyc/check", json=request_data)
    assert response1.status_code == 200
    result1 = response1.json()
    
    # Second call (should be identical)
    response2 = client.post("/v1/kyc/check", json=request_data)
    assert response2.status_code == 200
    result2 = response2.json()
    
    # Results should be identical
    assert result1 == result2

def test_aml_determinism():
    """Test that AML responses are deterministic"""
    os.environ['SEED'] = '42'
    
    request_data = {
        "subjectId": "TEST-001"
    }
    
    # First call
    response1 = client.post("/v1/aml/screen", json=request_data)
    assert response1.status_code == 200
    result1 = response1.json()
    
    # Second call (should be identical)
    response2 = client.post("/v1/aml/screen", json=request_data)
    assert response2.status_code == 200
    result2 = response2.json()
    
    # Results should be identical
    assert result1 == result2

def test_kyc_validation_errors():
    """Test KYC validation error handling"""
    # Invalid subject ID
    response = client.post("/v1/kyc/check", json={
        "subjectId": "invalid@id",
        "name": "John Doe"
    })
    assert response.status_code == 422
    
    # Invalid date format
    response = client.post("/v1/kyc/check", json={
        "subjectId": "TEST-001",
        "dob": "1990/01/01"
    })
    assert response.status_code == 422
    
    # Invalid document type
    response = client.post("/v1/kyc/check", json={
        "subjectId": "TEST-001",
        "docType": "invalid_type"
    })
    assert response.status_code == 422
    
    # Invalid document last 4
    response = client.post("/v1/kyc/check", json={
        "subjectId": "TEST-001",
        "docLast4": "123"
    })
    assert response.status_code == 422

def test_aml_validation_errors():
    """Test AML validation error handling"""
    # Invalid subject ID
    response = client.post("/v1/aml/screen", json={
        "subjectId": "invalid@id"
    })
    assert response.status_code == 422

def test_kyc_field_types():
    """Test KYC field type validation"""
    os.environ['SEED'] = ''
    
    request_data = {
        "subjectId": "TEST-001",
        "name": "John Doe",
        "dob": "1990-01-01",
        "docType": "passport",
        "docLast4": "1234"
    }
    
    response = client.post("/v1/kyc/check", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Verify field types
    assert isinstance(result["subjectId"], str)
    assert isinstance(result["status"], str)
    assert isinstance(result["reasons"], list)
    assert isinstance(result["confidence"], float)
    assert isinstance(result["timestamp"], int)
    
    # Verify status values
    assert result["status"] in ["pass", "review", "fail"]
    assert 0.0 <= result["confidence"] <= 1.0

def test_aml_field_types():
    """Test AML field type validation"""
    os.environ['SEED'] = ''
    
    request_data = {
        "subjectId": "TEST-001"
    }
    
    response = client.post("/v1/aml/screen", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    
    # Verify field types
    assert isinstance(result["subjectId"], str)
    assert isinstance(result["status"], str)
    assert isinstance(result["lists"], list)
    assert isinstance(result["score"], int)
    assert isinstance(result["timestamp"], int)
    
    # Verify status values
    assert result["status"] in ["clear", "hit"]
    assert 0 <= result["score"] <= 100

def test_kyc_optional_fields():
    """Test KYC with minimal required fields"""
    os.environ['SEED'] = ''
    
    # Only required field
    request_data = {
        "subjectId": "MINIMAL-001"
    }
    
    response = client.post("/v1/kyc/check", json=request_data)
    assert response.status_code == 200
    
    result = response.json()
    assert result["subjectId"] == "MINIMAL-001"
    assert "status" in result
    assert "confidence" in result
    assert "reasons" in result

def test_kyc_status_distribution():
    """Test that KYC statuses are distributed across different subjects"""
    os.environ['SEED'] = ''
    
    statuses = set()
    for i in range(10):
        request_data = {
            "subjectId": f"TEST-{i:03d}"
        }
        response = client.post("/v1/kyc/check", json=request_data)
        assert response.status_code == 200
        result = response.json()
        statuses.add(result["status"])
    
    # Should have multiple status types (not all the same)
    assert len(statuses) > 1

def test_aml_status_distribution():
    """Test that AML statuses are distributed across different subjects"""
    os.environ['SEED'] = ''
    
    statuses = set()
    for i in range(20):  # More samples for AML due to lower hit rate
        request_data = {
            "subjectId": f"TEST-{i:03d}"
        }
        response = client.post("/v1/aml/screen", json=request_data)
        assert response.status_code == 200
        result = response.json()
        statuses.add(result["status"])
    
    # Should have multiple status types (not all the same)
    assert len(statuses) > 1
