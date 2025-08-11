"""
Test deterministic model math with golden vectors
"""
import os
import pytest
from services.pricing.baseline_model import (
    score_risk, price_cds, get_risk_score_bps, jitter_bps,
    round_half_up, clamp
)

def test_round_half_up():
    """Test round_half_up function (not bankers' rounding)"""
    assert round_half_up(1.5) == 2
    assert round_half_up(2.5) == 3
    assert round_half_up(1.4) == 1
    assert round_half_up(1.6) == 2
    assert round_half_up(0.5) == 1
    assert round_half_up(-0.5) == 0

def test_clamp():
    """Test clamp function"""
    assert clamp(5, 1, 10) == 5
    assert clamp(0, 1, 10) == 1
    assert clamp(15, 1, 10) == 10
    assert clamp(1.5, 1.0, 2.0) == 1.5

def test_jitter_bps_override():
    """Test jitter override functionality"""
    # Test override
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '3'
    assert jitter_bps("test", "obligor", 365, 1726000000) == 3
    
    # Test empty seed
    del os.environ['MODEL_JITTER_BPS_OVERRIDE']
    os.environ['SEED'] = ''
    assert jitter_bps("", "obligor", 365, 1726000000) == 0
    
    # Test deterministic jitter
    os.environ['SEED'] = '42'
    jitter1 = jitter_bps("42", "obligor", 365, 1726000000)
    jitter2 = jitter_bps("42", "obligor", 365, 1726000000)
    assert jitter1 == jitter2
    assert -5 <= jitter1 <= 5

def test_golden_vector_a():
    """Test golden vector A with exact expected values"""
    # Set environment for deterministic testing
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    obligor_id = "ACME-LLC"
    tenor_days = 365
    as_of = 1726000000
    features = {
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
    
    # Test scoring
    score_result = score_risk(features, obligor_id, tenor_days, as_of)
    
    # Expected values from specification
    assert score_result['pdBps'] == 119
    assert score_result['lgdBps'] == 4501
    assert abs(score_result['scoreConfidence'] - 0.537) < 1e-9
    
    # Test pricing
    price_result = price_cds(obligor_id, tenor_days, features, 
                           score_result['pdBps'], score_result['lgdBps'], as_of)
    
    # Expected values from specification
    assert abs(price_result['elBps'] - 53.5619) < 1e-4
    assert abs(price_result['liqBps'] - 12.3) < 1e-4
    assert abs(price_result['rpBps'] - 6.5452) < 1e-4
    assert price_result['fairSpreadBps'] == 72
    assert price_result['correlationBps'] == 1605
    
    # Test risk score for digest
    risk_score_bps = get_risk_score_bps(score_result['pdBps'], score_result['lgdBps'])
    assert risk_score_bps == 54

def test_boundary_clamps():
    """Test boundary clamping behavior"""
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    # Test minimum clamps
    tiny_features = {
        "size": 0.001,
        "leverage": 0.001,
        "volatility": 0.001,
        "fxExposure": 0.001,
        "countryRisk": 0.001,
        "industryStress": 0.001,
        "collateralQuality": 0.999,  # High quality to minimize LGD
        "dataQuality": 0.001,
        "modelShift": 0.999  # High shift to minimize confidence
    }
    
    score_result = score_risk(tiny_features, "test", 365, 1726000000)
    assert score_result['pdBps'] >= 5  # Minimum PD
    assert score_result['lgdBps'] >= 2000  # Minimum LGD
    
    price_result = price_cds("test", 365, tiny_features, 
                           score_result['pdBps'], score_result['lgdBps'], 1726000000)
    assert price_result['fairSpreadBps'] >= 25  # Minimum spread
    assert price_result['correlationBps'] >= 1000  # Minimum correlation
    
    # Test maximum clamps
    large_features = {
        "size": 10.0,
        "leverage": 10.0,
        "volatility": 10.0,
        "fxExposure": 10.0,
        "countryRisk": 10.0,
        "industryStress": 10.0,
        "collateralQuality": 0.0,  # Low quality to maximize LGD
        "dataQuality": 10.0,
        "modelShift": 0.0  # Low shift to maximize confidence
    }
    
    score_result = score_risk(large_features, "test", 365, 1726000000)
    assert score_result['pdBps'] <= 3000  # Maximum PD
    assert score_result['lgdBps'] <= 9000  # Maximum LGD
    
    price_result = price_cds("test", 365, large_features, 
                           score_result['pdBps'], score_result['lgdBps'], 1726000000)
    assert price_result['correlationBps'] <= 9000  # Maximum correlation

def test_determinism():
    """Test that outputs are deterministic with fixed seed"""
    os.environ['SEED'] = '42'
    # Don't set override so jitter is deterministic
    
    features = {
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
    
    # First call
    score1 = score_risk(features, "test", 365, 1726000000)
    price1 = price_cds("test", 365, features, score1['pdBps'], score1['lgdBps'], 1726000000)
    
    # Second call (should be identical)
    score2 = score_risk(features, "test", 365, 1726000000)
    price2 = price_cds("test", 365, features, score2['pdBps'], score2['lgdBps'], 1726000000)
    
    # All values should be identical
    assert score1 == score2
    assert price1 == price2

def test_missing_features_default_to_zero():
    """Test that missing features default to 0.0"""
    os.environ['MODEL_JITTER_BPS_OVERRIDE'] = '0'
    os.environ['SEED'] = ''
    
    # Test with empty features dict
    empty_features = {}
    score_result = score_risk(empty_features, "test", 365, 1726000000)
    
    # Should use all zeros, resulting in minimum values
    assert score_result['pdBps'] == 5  # Minimum PD
    assert score_result['lgdBps'] == 4500  # Base LGD (4500 + 0 - 0)
    assert score_result['scoreConfidence'] == 0.50  # Base confidence (0.50 + 0 - 0)
    
    price_result = price_cds("test", 365, empty_features, 
                           score_result['pdBps'], score_result['lgdBps'], 1726000000)
    assert price_result['fairSpreadBps'] == 25  # Minimum spread
    assert price_result['correlationBps'] == 1500  # Base correlation (15 * 100)
