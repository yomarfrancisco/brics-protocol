from pydantic import BaseModel, Field
from typing import Any, Dict

class PriceRequest(BaseModel):
    portfolioId: str = Field(..., description="0x-prefixed 32-byte hex")
    asOf: int = Field(..., description="unix seconds (uint64)")
    modelId: str = Field("xgb-v0-stub")
    features: Dict[str, Any]

class PriceResponse(BaseModel):
    asOf: int
    riskScore: str      # uint256 as decimal string
    correlationBps: int
    spreadBps: int
    modelId: str
    digest: str         # 0x...
    signature: str      # 0x...
    portfolioId: str
    featuresHash: str
