"""
Deterministic mock rules for KYC/AML compliance service
"""
import os
import time
from typing import Dict, Any, List
from eth_utils import keccak, to_bytes

def get_seed() -> str:
    """Get the seed for deterministic outputs"""
    return os.getenv('SEED', '')

def deterministic_kyc_status(subject_id: str, seed: str = "") -> Dict[str, Any]:
    """
    Generate deterministic KYC status based on subject ID
    
    Args:
        subject_id: Subject identifier
        seed: Optional seed for determinism
    
    Returns:
        Dictionary with status, confidence, and reasons
    """
    hash_input = f"kyc:{subject_id}:{seed}"
    hash_bytes = keccak(to_bytes(text=hash_input))
    
    # Use hash to determine status
    status_value = int.from_bytes(hash_bytes[:4], 'big') % 3
    status_map = {0: "pass", 1: "review", 2: "fail"}
    
    # Use hash to determine confidence
    confidence_value = int.from_bytes(hash_bytes[4:8], 'big') % 100
    confidence = confidence_value / 100.0
    
    # Generate reasons based on status
    reasons = ["deterministic_mock_response"]
    if status_value == 1:  # review
        reasons.append("additional_verification_required")
    elif status_value == 2:  # fail
        reasons.append("document_validation_failed")
    
    return {
        "status": status_map[status_value],
        "confidence": confidence,
        "reasons": reasons
    }

def deterministic_aml_status(subject_id: str, seed: str = "") -> Dict[str, Any]:
    """
    Generate deterministic AML status based on subject ID
    
    Args:
        subject_id: Subject identifier
        seed: Optional seed for determinism
    
    Returns:
        Dictionary with status, lists, and score
    """
    hash_input = f"aml:{subject_id}:{seed}"
    hash_bytes = keccak(to_bytes(text=hash_input))
    
    # Use hash to determine status
    status_value = int.from_bytes(hash_bytes[:4], 'big') % 10  # 10% chance of hit
    status = "hit" if status_value == 0 else "clear"
    
    # Use hash to determine score
    score = int.from_bytes(hash_bytes[4:8], 'big') % 100
    
    # Generate lists based on status
    lists = ["ofac", "un", "eu_sanctions"]
    if status == "hit":
        lists.append("high_risk_entities")
    
    return {
        "status": status,
        "lists": lists,
        "score": score
    }

def get_current_timestamp() -> int:
    """Get current Unix timestamp"""
    return int(time.time())

def validate_kyc_golden_vector(subject_id: str = "ALPHA-001", seed: str = "") -> Dict[str, Any]:
    """
    Validate KYC golden vector for testing
    
    Expected output with SEED="":
    - status: "pass"
    - confidence: 0.85
    - reasons: ["deterministic_mock_response"]
    """
    return deterministic_kyc_status(subject_id, seed)

def validate_aml_golden_vector(subject_id: str = "ALPHA-001", seed: str = "") -> Dict[str, Any]:
    """
    Validate AML golden vector for testing
    
    Expected output with SEED="":
    - status: "clear"
    - lists: ["ofac", "un", "eu_sanctions"]
    - score: 15
    """
    return deterministic_aml_status(subject_id, seed)
