"""
BRICS Risk API - Pydantic models for API responses.

Defines response schemas for all endpoints with proper typing and validation.
All models include timestamp and optional signature fields.
"""

from typing import Optional

from pydantic import BaseModel, Field


class StampedModel(BaseModel):
    """Base model with timestamp field."""
    ts: int = Field(..., description="Unix timestamp in seconds")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    ts: int = Field(..., description="Unix timestamp in seconds")


class PublicKeyResponse(BaseModel):
    """Public key response for signature verification."""
    ed25519_pubkey_hex: str = Field(..., description="Hex-encoded Ed25519 public key")


class NavLatestResponse(StampedModel):
    """Latest NAV response with emergency fallback."""
    nav_ray: int = Field(..., description="Current NAV in ray format (1e27)")
    model_hash: str = Field(..., description="Hash of NAV calculation model")
    emergency_nav_ray: int = Field(..., description="Emergency NAV in ray format")
    emergency_enabled: int = Field(..., description="Emergency mode enabled (0/1)")
    sig: Optional[str] = Field(None, description="Ed25519 signature of canonical JSON")


class EmergencyLevelResponse(StampedModel):
    """Emergency state response."""
    level: int = Field(..., description="Emergency level (0=GREEN, 1=AMBER, 2=RED)")
    reason: str = Field(..., description="Emergency reason description")
    sig: Optional[str] = Field(None, description="Ed25519 signature of canonical JSON")


class IssuanceStateResponse(StampedModel):
    """Issuance controller state response."""
    locked: int = Field(..., description="Issuance locked (0/1)")
    cap_tokens: int = Field(..., description="Current issuance cap in tokens")
    detach_bps: int = Field(..., description="Detachment level in basis points")
    ratify_until: int = Field(..., description="Ratification deadline timestamp")
    sig: Optional[str] = Field(None, description="Ed25519 signature of canonical JSON")


class RiskSummaryResponse(StampedModel):
    """Risk metrics summary response."""
    defaults_bps: int = Field(..., description="Default risk in basis points")
    sovereign_usage_bps: int = Field(..., description="Sovereign usage in basis points")
    correlation_bps: int = Field(..., description="Correlation risk in basis points")
    sig: Optional[str] = Field(None, description="Ed25519 signature of canonical JSON")
