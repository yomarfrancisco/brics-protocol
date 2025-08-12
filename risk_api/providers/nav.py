"""
BRICS Risk API - NAV Oracle data provider.

Provides NAV data including current NAV, model hash, and emergency fallback values.
TODO: Replace with on-chain NAVOracleV3 adapter.
"""

import os
import time
from typing import Dict, Any


class NavProvider:
    """In-memory NAV data provider with environment configuration."""

    def __init__(self) -> None:
        """Initialize NAV provider with values from environment."""
        # TODO: Replace with on-chain NAVOracleV3 adapter
        self._nav_ray = int(os.getenv("NAV_RAY", "1000000000000000000000000000"))
        self._model_hash = os.getenv("NAV_MODEL_HASH", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        self._emergency_nav_ray = int(os.getenv("EMERGENCY_NAV_RAY", "1000000000000000000000000000"))
        self._emergency_enabled = int(os.getenv("EMERGENCY_ENABLED", "0"))

    def get_nav_data(self) -> Dict[str, Any]:
        """Get current NAV data.
        
        Returns:
            Dictionary with nav_ray, model_hash, emergency_nav_ray, emergency_enabled, ts
        """
        return {
            "nav_ray": self._nav_ray,
            "model_hash": self._model_hash,
            "emergency_nav_ray": self._emergency_nav_ray,
            "emergency_enabled": self._emergency_enabled,
            "ts": int(time.time()),
        }

    # Test methods for setting values
    def _set_nav_ray(self, nav_ray: int) -> None:
        """Set NAV ray value (for testing only)."""
        self._nav_ray = nav_ray

    def _set_model_hash(self, model_hash: str) -> None:
        """Set model hash (for testing only)."""
        self._model_hash = model_hash

    def _set_emergency_nav_ray(self, emergency_nav_ray: int) -> None:
        """Set emergency NAV ray (for testing only)."""
        self._emergency_nav_ray = emergency_nav_ray

    def _set_emergency_enabled(self, emergency_enabled: int) -> None:
        """Set emergency enabled flag (for testing only)."""
        self._emergency_enabled = emergency_enabled
