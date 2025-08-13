"""
BRICS Risk API - Safety check providers.

Provides safety check logic for lane pre-trade validation and NAV sanity checks.
These are pure functions that mirror the on-chain logic without RPC dependencies.
"""

import json
import os
from typing import Dict, Any, Optional


class SafetyProvider:
    """Safety check provider with pure function implementations."""

    def __init__(self) -> None:
        """Initialize safety provider."""
        # Default bounds for emergency levels (matching InstantLane.sol)
        self._bounds = {
            0: (9800, 10200),   # Level 0: ±2%
            1: (9900, 10100),   # Level 1: ±1%
            2: (9975, 10025),   # Level 2: ±0.25%
        }
        
        # Default NAV sanity settings
        self._default_max_jump_bps = 500  # 5%
        self._default_prev_nav_ray = 1000000000000000000000000000  # 1.0 in RAY

    def get_lane_pretrade_data(self, price_bps: int, emergency_level: int) -> Dict[str, Any]:
        """Get lane pre-trade check data.
        
        Args:
            price_bps: Price in basis points (e.g., 10000 = 100%)
            emergency_level: Emergency level to check bounds for
            
        Returns:
            Dictionary with pre-trade check results
        """
        # Get bounds for the emergency level
        if emergency_level in self._bounds:
            min_bps, max_bps = self._bounds[emergency_level]
        else:
            # For levels >= 3, use the most restrictive bounds
            min_bps, max_bps = self._bounds[2]
        
        # Check if price is within bounds
        ok = 1 if min_bps <= price_bps <= max_bps else 0
        
        return {
            "ok": ok,
            "min_bps": min_bps,
            "max_bps": max_bps,
            "price_bps": price_bps,
            "emergency_level": emergency_level,
        }

    def get_nav_sanity_data(
        self, 
        proposed_nav_ray: int, 
        max_jump_bps: Optional[int] = None,
        emergency_enabled: int = 0,
        prev_nav_ray: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get NAV sanity check data.
        
        Args:
            proposed_nav_ray: Proposed NAV in ray format
            max_jump_bps: Maximum allowed jump in basis points (default: 500)
            emergency_enabled: Whether emergency mode is enabled (0/1)
            prev_nav_ray: Previous NAV in ray format (default: 1.0 RAY)
            
        Returns:
            Dictionary with NAV sanity check results
        """
        # Use defaults if not provided
        if max_jump_bps is None:
            max_jump_bps = self._default_max_jump_bps
        
        if prev_nav_ray is None:
            prev_nav_ray = self._default_prev_nav_ray
            assumed_prev = 1
        else:
            assumed_prev = 0
        
        # Check if NAV jump is allowed
        ok = 1  # Default to allowed
        
        if prev_nav_ray != 0 and not emergency_enabled:
            # Calculate bounds
            hi = prev_nav_ray * (10000 + max_jump_bps) // 10000
            lo = prev_nav_ray * (10000 - max_jump_bps) // 10000
            
            # Check if proposed NAV is within bounds
            if not (lo <= proposed_nav_ray <= hi):
                ok = 0
        
        return {
            "ok": ok,
            "prev_nav_ray": prev_nav_ray,
            "proposed_nav_ray": proposed_nav_ray,
            "max_jump_bps": max_jump_bps,
            "emergency_enabled": emergency_enabled,
            "assumed_prev": assumed_prev,
        }

    def _load_devstack_addresses(self) -> Optional[Dict[str, str]]:
        """Load addresses from .devstack/addresses.json if present."""
        try:
            devstack_path = os.path.join(os.getcwd(), ".devstack", "addresses.json")
            if os.path.exists(devstack_path):
                with open(devstack_path, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return None

