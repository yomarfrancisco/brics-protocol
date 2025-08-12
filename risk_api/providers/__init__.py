"""
BRICS Risk API - Data providers package.

Contains in-memory data providers for NAV, emergency state, issuance, and risk metrics.
These are temporary implementations that will be replaced with on-chain adapters.
"""

from .emergency import EmergencyProvider
from .issuance import IssuanceProvider
from .nav import NavProvider
from .risk import RiskProvider

__all__ = ["NavProvider", "EmergencyProvider", "IssuanceProvider", "RiskProvider"]
