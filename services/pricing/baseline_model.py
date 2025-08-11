import os
import hashlib
import json
from typing import Dict, Any

def get_seed() -> int:
    """Get the seed for deterministic outputs"""
    return int(os.getenv('SEED', '42'))

def deterministic_jitter(input_str: str, max_bps: int = 50) -> int:
    """Generate deterministic jitter based on input string"""
    seed = get_seed()
    hash_input = f"{input_str}:{seed}"
    hash_bytes = hashlib.sha256(hash_input.encode()).digest()
    return int.from_bytes(hash_bytes[:4], 'big') % max_bps

def score_risk(features: Dict[str, Any], obligor_id: str) -> Dict[str, Any]:
    """
    Baseline risk scoring with deterministic outputs
    
    Features expected:
    - size: float (0-1 scale)
    - leverage: float (0-1 scale) 
    - volatility: float (0-1 scale)
    - fxExposure: float (0-1 scale)
    - countryRisk: float (0-1 scale)
    - industryStress: float (0-1 scale)
    - collateralQuality: float (0-1 scale)
    - dataQuality: float (0-1 scale)
    - modelShift: float (0-1 scale)
    """
    # Default missing features to 0
    size = features.get('size', 0.0)
    leverage = features.get('leverage', 0.0)
    volatility = features.get('volatility', 0.0)
    fx_exposure = features.get('fxExposure', 0.0)
    country_risk = features.get('countryRisk', 0.0)
    industry_stress = features.get('industryStress', 0.0)
    collateral_quality = features.get('collateralQuality', 0.0)
    data_quality = features.get('dataQuality', 0.0)
    model_shift = features.get('modelShift', 0.0)
    
    # Calculate PD (Probability of Default)
    pd_bps_raw = (50 * size + 80 * leverage + 40 * volatility + 
                  30 * fx_exposure + 20 * country_risk)
    
    # Add deterministic jitter
    jitter = deterministic_jitter(f"pd:{obligor_id}")
    pd_bps_raw += jitter
    
    # Clamp to reasonable range
    pd_bps = max(5, min(3000, round(pd_bps_raw)))
    
    # Calculate LGD (Loss Given Default)
    lgd_bps_raw = 4500 + 10 * industry_stress - 5 * collateral_quality
    lgd_bps = max(2000, min(9000, round(lgd_bps_raw)))
    
    # Calculate confidence score
    confidence_raw = 0.50 + 0.05 * data_quality - 0.03 * model_shift
    score_confidence = max(0.3, min(0.95, confidence_raw))
    
    return {
        'pdBps': pd_bps,
        'lgdBps': lgd_bps,
        'scoreConfidence': round(score_confidence, 3)
    }

def price_cds(obligor_id: str, tenor_days: int, features: Dict[str, Any], 
              pd_bps: int, lgd_bps: int) -> Dict[str, Any]:
    """
    Baseline CDS pricing with deterministic outputs
    """
    # Calculate Expected Loss
    el_bps = (pd_bps * lgd_bps) // 10000
    
    # Calculate liquidity premium
    liq_bps_raw = 5 + 0.02 * tenor_days
    liq_jitter = deterministic_jitter(f"liq:{obligor_id}:{tenor_days}")
    liq_bps = liq_bps_raw + liq_jitter
    
    # Calculate risk premium
    volatility = features.get('volatility', 0.0)
    rp_bps = 0.6 * (max(pd_bps, 1) ** 0.5)
    
    # Calculate fair spread
    fair_spread_bps_raw = el_bps + liq_bps + rp_bps
    fair_spread_bps = max(25, min(3000, round(fair_spread_bps_raw)))
    
    # Calculate correlation
    country_risk = features.get('countryRisk', 0.0)
    corr_raw = (15 + 2.5 * volatility + 1.5 * country_risk) * 100
    correlation_bps = max(1000, min(9000, round(corr_raw)))
    
    return {
        'fairSpreadBps': fair_spread_bps,
        'correlationBps': correlation_bps,
        'elBps': el_bps
    }

def generate_dummy_digest(obligor_id: str, as_of: int) -> str:
    """Generate a dummy digest for now (will be replaced with real signing)"""
    input_str = f"{obligor_id}:{as_of}:{get_seed()}"
    hash_bytes = hashlib.sha256(input_str.encode()).digest()
    return "0x" + hash_bytes.hex()

def generate_dummy_signature(obligor_id: str, as_of: int) -> str:
    """Generate a dummy signature for now (will be replaced with real signing)"""
    input_str = f"sig:{obligor_id}:{as_of}:{get_seed()}"
    hash_bytes = hashlib.sha256(input_str.encode()).digest()
    return "0x" + hash_bytes.hex()
