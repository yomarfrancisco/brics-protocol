"""
BRICS Risk API - Risk metrics data provider.

Provides aggregate risk metrics including defaults, sovereign usage, and correlation.
TODO: Replace with on-chain risk calculation adapter.
"""

import os
import time
from typing import Dict, Any


class RiskProvider:
    """In-memory risk metrics provider with environment configuration."""

    def __init__(self) -> None:
        """Initialize risk provider with values from environment."""
        # TODO: Replace with on-chain risk calculation adapter
        self._defaults_bps = int(os.getenv("RISK_DEFAULTS_BPS", "300"))
        self._sovereign_usage_bps = int(os.getenv("RISK_SOVEREIGN_USAGE_BPS", "0"))
        self._correlation_bps = int(os.getenv("RISK_CORRELATION_BPS", "250"))

    def get_risk_data(self) -> Dict[str, Any]:
        """Get current risk metrics data.
        
        Returns:
            Dictionary with defaults_bps, sovereign_usage_bps, correlation_bps, ts
        """
        return {
            "defaults_bps": self._defaults_bps,
            "sovereign_usage_bps": self._sovereign_usage_bps,
            "correlation_bps": self._correlation_bps,
            "ts": int(time.time()),
        }

    # Test methods for setting values
    def _set_defaults_bps(self, defaults_bps: int) -> None:
        """Set defaults basis points (for testing only)."""
        self._defaults_bps = defaults_bps

    def _set_sovereign_usage_bps(self, sovereign_usage_bps: int) -> None:
        """Set sovereign usage basis points (for testing only)."""
        self._sovereign_usage_bps = sovereign_usage_bps

    def _set_correlation_bps(self, correlation_bps: int) -> None:
        """Set correlation basis points (for testing only)."""
        self._correlation_bps = correlation_bps
