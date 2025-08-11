import os
import math
from typing import Dict, Any
from eth_utils import keccak, to_bytes

def get_seed() -> str:
    """Get the seed for deterministic outputs"""
    return os.getenv('SEED', '42')

def round_half_up(value: float) -> int:
    """Round half-up (not Python's bankers' rounding)"""
    return int(value + 0.5)

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value between min and max"""
    return max(min_val, min(max_val, value))

def jitter_bps(seed: str, obligor_id: str, tenor_days: int, as_of: int) -> int:
    """
    Deterministic jitter in basis points [-5, +5]
    
    Args:
        seed: string seed for determinism
        obligor_id: obligor identifier
        tenor_days: tenor in days
        as_of: timestamp
    
    Returns:
        jitter in basis points [-5, +5]
    """
    # Check for override
    override = os.getenv('MODEL_JITTER_BPS_OVERRIDE')
    if override is not None:
        return int(override)
    
    # If SEED is empty, treat jitter as 0
    if not seed:
        return 0
    
    # Default: compute keccak256(utf8(obligorId + ":" + tenorDays + ":" + asOf + ":" + seed))
    input_str = f"{obligor_id}:{tenor_days}:{as_of}:{seed}"
    hash_bytes = keccak(to_bytes(text=input_str))
    
    # Take last 2 bytes mod 11, then value - 5
    last_two_bytes = hash_bytes[-2:]
    value = int.from_bytes(last_two_bytes, 'big') % 11
    return value - 5

def score_risk(features: Dict[str, Any], obligor_id: str, tenor_days: int, as_of: int) -> Dict[str, Any]:
    """
    Baseline risk scoring with deterministic outputs
    
    Features expected (missing features default to 0.0):
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
    # Default missing features to 0.0
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
    # pdBps_raw = 50*size + 80*leverage + 40*volatility + 30*fxExposure + 20*countryRisk
    pd_bps_raw = 50 * size + 80 * leverage + 40 * volatility + 30 * fx_exposure + 20 * country_risk
    
    # pdBps = clamp(round_half_up(pdBps_raw), 5, 3000)
    pd_bps = clamp(round_half_up(pd_bps_raw), 5, 3000)
    
    # Calculate LGD (Loss Given Default)
    # lgdBps_raw = 4500 + 10*industryStress - 5*collateralQuality
    lgd_bps_raw = 4500 + 10 * industry_stress - 5 * collateral_quality
    
    # lgdBps = clamp(round_half_up(lgdBps_raw), 2000, 9000)
    lgd_bps = clamp(round_half_up(lgd_bps_raw), 2000, 9000)
    
    # Calculate confidence score
    # scoreConfidence = clamp(0.50 + 0.05*dataQuality - 0.03*modelShift, 0.30, 0.95)
    score_confidence = clamp(0.50 + 0.05 * data_quality - 0.03 * model_shift, 0.30, 0.95)
    
    return {
        'pdBps': int(pd_bps),
        'lgdBps': int(lgd_bps),
        'scoreConfidence': score_confidence
    }

def price_cds(obligor_id: str, tenor_days: int, features: Dict[str, Any], 
              pd_bps: int, lgd_bps: int, as_of: int) -> Dict[str, Any]:
    """
    Baseline CDS pricing with deterministic outputs
    """
    # Calculate Expected Loss
    # EL_bps = (pdBps * lgdBps) / 10000.0
    el_bps = (pd_bps * lgd_bps) / 10000.0
    
    # Calculate liquidity premium
    # liq_bps = 5 + 0.02*tenorDays + jitter_bps
    liq_bps_raw = 5 + 0.02 * tenor_days
    jitter = jitter_bps(get_seed(), obligor_id, tenor_days, as_of)
    liq_bps = liq_bps_raw + jitter
    
    # Calculate risk premium
    # rp_bps = 0.6 * sqrt(max(pdBps, 1))
    rp_bps = 0.6 * math.sqrt(max(pd_bps, 1))
    
    # Calculate fair spread
    # fairSpreadBps_raw = EL_bps + liq_bps + rp_bps
    fair_spread_bps_raw = el_bps + liq_bps + rp_bps
    
    # fairSpreadBps = clamp(round_half_up(fairSpreadBps_raw), 25, 3000)
    fair_spread_bps = clamp(round_half_up(fair_spread_bps_raw), 25, 3000)
    
    # Calculate correlation
    volatility = features.get('volatility', 0.0)
    country_risk = features.get('countryRisk', 0.0)
    
    # correlationBps = clamp(round_half_up((15 + 2.5*volatility + 1.5*countryRisk) * 100), 1000, 9000)
    corr_raw = (15 + 2.5 * volatility + 1.5 * country_risk) * 100
    correlation_bps = clamp(round_half_up(corr_raw), 1000, 9000)
    
    return {
        'fairSpreadBps': int(fair_spread_bps),
        'correlationBps': int(correlation_bps),
        'elBps': el_bps,
        'liqBps': liq_bps,
        'rpBps': rp_bps
    }

def get_risk_score_bps(pd_bps: int, lgd_bps: int) -> int:
    """
    Get risk score in basis points for digest (round_half_up(EL_bps))
    """
    el_bps = (pd_bps * lgd_bps) / 10000.0
    return round_half_up(el_bps)
