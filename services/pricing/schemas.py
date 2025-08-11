from pydantic import BaseModel, Field
from typing import Any, Dict

class ScoreRequest(BaseModel):
    obligorId: str = Field(..., description="Obligor identifier")
    tenorDays: int = Field(..., description="Tenor in days")
    asOf: int = Field(..., description="unix seconds (uint64)")
    features: Dict[str, Any] = Field(..., description="Risk features")

class ScoreResponse(BaseModel):
    obligorId: str
    tenorDays: int
    asOf: int
    pdBps: int = Field(..., description="Probability of default in basis points")
    lgdBps: int = Field(..., description="Loss given default in basis points")
    scoreConfidence: float = Field(..., description="Confidence score (0.0-1.0)")

class PriceRequest(BaseModel):
    obligorId: str = Field(..., description="Obligor identifier")
    tenorDays: int = Field(..., description="Tenor in days")
    asOf: int = Field(..., description="unix seconds (uint64)")
    notional: int = Field(..., description="Notional amount")
    modelId: str = Field("baseline-v0", description="Model identifier")
    features: Dict[str, Any] = Field(..., description="Risk features")

class PriceResponse(BaseModel):
    obligorId: str
    tenorDays: int
    asOf: int
    notional: int
    fairSpreadBps: int = Field(..., description="Fair spread in basis points")
    correlationBps: int = Field(..., description="Correlation in basis points")
    digest: str = Field(..., description="0x-prefixed digest")
    signature: str = Field(..., description="0x-prefixed signature")
