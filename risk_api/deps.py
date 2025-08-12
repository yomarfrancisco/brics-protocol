"""
BRICS Risk API - FastAPI dependencies and initialization.

Provides dependency injection for signing key and data providers,
with environment configuration loading.
"""

import os
from functools import lru_cache
from typing import Dict, Any

from dotenv import load_dotenv

from .providers import NavProvider, EmergencyProvider, IssuanceProvider, RiskProvider
from .signing import SigningKey


# Load environment variables from .env file if present
load_dotenv()


@lru_cache()
def get_signing_key() -> SigningKey:
    """Get cached signing key instance.
    
    Returns:
        Initialized SigningKey instance
        
    Raises:
        ValueError: If RISK_API_ED25519_SK_HEX is not set or invalid
    """
    secret_key_hex = os.getenv('RISK_API_ED25519_SK_HEX')
    if not secret_key_hex:
        raise ValueError("RISK_API_ED25519_SK_HEX environment variable is required")
    
    return SigningKey(secret_key_hex)


@lru_cache()
def get_providers() -> Dict[str, Any]:
    """Get cached data providers.
    
    Returns:
        Dictionary with all data providers
    """
    return {
        "nav": NavProvider(),
        "emergency": EmergencyProvider(),
        "issuance": IssuanceProvider(),
        "risk": RiskProvider(),
    }


def get_nav_provider() -> NavProvider:
    """Get NAV provider instance."""
    return get_providers()["nav"]


def get_emergency_provider() -> EmergencyProvider:
    """Get emergency provider instance."""
    return get_providers()["emergency"]


def get_issuance_provider() -> IssuanceProvider:
    """Get issuance provider instance."""
    return get_providers()["issuance"]


def get_risk_provider() -> RiskProvider:
    """Get risk provider instance."""
    return get_providers()["risk"]
