"""
BRICS Risk API - Issuance controller data provider.

Provides issuance state including lock status, cap, detachment, and ratification.
TODO: Replace with on-chain IssuanceControllerV4 adapter.
"""

import os
import time
from typing import Dict, Any


class IssuanceProvider:
    """In-memory issuance state provider with environment configuration."""

    def __init__(self) -> None:
        """Initialize issuance provider with values from environment."""
        # TODO: Replace with on-chain IssuanceControllerV4 adapter
        self._locked = int(os.getenv("ISS_LOCKED", "0"))
        self._cap_tokens = int(os.getenv("ISS_CAP_TOKENS", "4440000000000000000000000"))
        self._detach_bps = int(os.getenv("ISS_DETACH_BPS", "10200"))
        self._ratify_until = int(os.getenv("ISS_RATIFY_UNTIL", "0"))

    def get_issuance_data(self) -> Dict[str, Any]:
        """Get current issuance state data.
        
        Returns:
            Dictionary with locked, cap_tokens, detach_bps, ratify_until, ts
        """
        return {
            "locked": self._locked,
            "cap_tokens": self._cap_tokens,
            "detach_bps": self._detach_bps,
            "ratify_until": self._ratify_until,
            "ts": int(time.time()),
        }

    # Test methods for setting values
    def _set_locked(self, locked: int) -> None:
        """Set issuance locked status (for testing only)."""
        self._locked = locked

    def _set_cap_tokens(self, cap_tokens: int) -> None:
        """Set issuance cap (for testing only)."""
        self._cap_tokens = cap_tokens

    def _set_detach_bps(self, detach_bps: int) -> None:
        """Set detachment basis points (for testing only)."""
        self._detach_bps = detach_bps

    def _set_ratify_until(self, ratify_until: int) -> None:
        """Set ratification deadline (for testing only)."""
        self._ratify_until = ratify_until
