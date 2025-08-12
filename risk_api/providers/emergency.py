"""
BRICS Risk API - Emergency state data provider.

Provides emergency level and reason information.
TODO: Replace with on-chain ConfigRegistry adapter.
"""

import os
import time
from typing import Dict, Any


class EmergencyProvider:
    """In-memory emergency state provider with environment configuration."""

    def __init__(self) -> None:
        """Initialize emergency provider with values from environment."""
        # TODO: Replace with on-chain ConfigRegistry adapter
        self._level = int(os.getenv("EMERGENCY_LEVEL", "0"))
        self._reason = os.getenv("EMERGENCY_REASON", "normal")

    def get_emergency_data(self) -> Dict[str, Any]:
        """Get current emergency state data.
        
        Returns:
            Dictionary with level, reason, ts
        """
        return {
            "level": self._level,
            "reason": self._reason,
            "ts": int(time.time()),
        }

    # Test methods for setting values
    def _set_level(self, level: int) -> None:
        """Set emergency level (for testing only)."""
        self._level = level

    def _set_reason(self, reason: str) -> None:
        """Set emergency reason (for testing only)."""
        self._reason = reason
