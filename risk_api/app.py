"""
BRICS Risk API - Main FastAPI application.

Provides aggregate-only risk feeds with deterministic Ed25519 signing
for data integrity and authenticity verification.
"""

import os
import time
from typing import Dict, Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .deps import (
    get_signing_key,
    get_nav_provider,
    get_emergency_provider,
    get_issuance_provider,
    get_risk_provider,
)
from .signing import SigningKey
from .models import (
    HealthResponse,
    PublicKeyResponse,
    NavLatestResponse,
    EmergencyLevelResponse,
    IssuanceStateResponse,
    RiskSummaryResponse,
)

# Create FastAPI app
app = FastAPI(
    title="BRICS Risk API",
    description="Aggregate-only risk feeds with deterministic Ed25519 signing",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.get("/api/v1/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint.
    
    Returns:
        Service status and current timestamp
    """
    return HealthResponse(
        status="ok",
        ts=int(time.time()),
    )


@app.get("/.well-known/risk-api-pubkey", response_model=PublicKeyResponse, tags=["public"])
async def get_public_key(signing_key: SigningKey = Depends(get_signing_key)) -> PublicKeyResponse:
    """Get public key for signature verification.
    
    Args:
        signing_key: Ed25519 signing key instance
        
    Returns:
        Hex-encoded Ed25519 public key
    """
    return PublicKeyResponse(
        ed25519_pubkey_hex=signing_key.public_key_hex(),
    )


@app.get("/api/v1/nav/latest", response_model=NavLatestResponse, tags=["nav"])
async def get_nav_latest(
    signing_key: SigningKey = Depends(get_signing_key),
    nav_provider = Depends(get_nav_provider),
) -> NavLatestResponse:
    """Get latest NAV data with emergency fallback.
    
    Args:
        signing_key: Ed25519 signing key instance
        nav_provider: NAV data provider
        
    Returns:
        NAV data with Ed25519 signature
    """
    # Get NAV data
    nav_data = nav_provider.get_nav_data()
    
    # Generate signature
    signature = signing_key.sign(nav_data)
    
    return NavLatestResponse(
        nav_ray=nav_data["nav_ray"],
        model_hash=nav_data["model_hash"],
        emergency_nav_ray=nav_data["emergency_nav_ray"],
        emergency_enabled=nav_data["emergency_enabled"],
        ts=nav_data["ts"],
        sig=signature,
    )


@app.get("/api/v1/emergency/level", response_model=EmergencyLevelResponse, tags=["emergency"])
async def get_emergency_level(
    signing_key: SigningKey = Depends(get_signing_key),
    emergency_provider = Depends(get_emergency_provider),
) -> EmergencyLevelResponse:
    """Get current emergency state.
    
    Args:
        signing_key: Ed25519 signing key instance
        emergency_provider: Emergency state provider
        
    Returns:
        Emergency state with Ed25519 signature
    """
    # Get emergency data
    emergency_data = emergency_provider.get_emergency_data()
    
    # Generate signature
    signature = signing_key.sign(emergency_data)
    
    return EmergencyLevelResponse(
        level=emergency_data["level"],
        reason=emergency_data["reason"],
        ts=emergency_data["ts"],
        sig=signature,
    )


@app.get("/api/v1/issuance/state", response_model=IssuanceStateResponse, tags=["issuance"])
async def get_issuance_state(
    signing_key: SigningKey = Depends(get_signing_key),
    issuance_provider = Depends(get_issuance_provider),
) -> IssuanceStateResponse:
    """Get current issuance controller state.
    
    Args:
        signing_key: Ed25519 signing key instance
        issuance_provider: Issuance state provider
        
    Returns:
        Issuance state with Ed25519 signature
    """
    # Get issuance data
    issuance_data = issuance_provider.get_issuance_data()
    
    # Generate signature
    signature = signing_key.sign(issuance_data)
    
    return IssuanceStateResponse(
        locked=issuance_data["locked"],
        cap_tokens=issuance_data["cap_tokens"],
        detach_bps=issuance_data["detach_bps"],
        ratify_until=issuance_data["ratify_until"],
        ts=issuance_data["ts"],
        sig=signature,
    )


@app.get("/api/v1/risk/summary", response_model=RiskSummaryResponse, tags=["risk"])
async def get_risk_summary(
    signing_key: SigningKey = Depends(get_signing_key),
    risk_provider = Depends(get_risk_provider),
) -> RiskSummaryResponse:
    """Get aggregate risk metrics summary.
    
    Args:
        signing_key: Ed25519 signing key instance
        risk_provider: Risk metrics provider
        
    Returns:
        Risk summary with Ed25519 signature
    """
    # Get risk data
    risk_data = risk_provider.get_risk_data()
    
    # Generate signature
    signature = signing_key.sign(risk_data)
    
    return RiskSummaryResponse(
        defaults_bps=risk_data["defaults_bps"],
        sovereign_usage_bps=risk_data["sovereign_usage_bps"],
        correlation_bps=risk_data["correlation_bps"],
        ts=risk_data["ts"],
        sig=signature,
    )


@app.exception_handler(ValueError)
async def value_error_handler(request, exc: ValueError) -> JSONResponse:
    """Handle ValueError exceptions (e.g., missing environment variables)."""
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
    )


def main() -> None:
    """Main entry point for running the application."""
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(
        "risk_api.app:app",
        host=host,
        port=port,
        reload=True,
    )


if __name__ == "__main__":
    main()
