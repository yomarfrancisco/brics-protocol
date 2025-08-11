import os
import logging
from fastapi import FastAPI
from dotenv import load_dotenv
from eth_utils import to_bytes
from schemas import ScoreRequest, ScoreResponse, PriceRequest, PriceResponse
from baseline_model import score_risk, price_cds, generate_dummy_digest, generate_dummy_signature
from crypto import load_or_create_key, sign_digest, public_address

load_dotenv()
app = FastAPI(title="BRICS Pricing v0.1")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
RISK_ORACLE_PK = load_or_create_key()
RISK_ORACLE_ADDR = public_address(RISK_ORACLE_PK)

# Log configuration (no secrets)
logger.info(f"BRICS Pricing Service starting...")
logger.info(f"Model: {os.getenv('MODEL', 'baseline-v0')}")
logger.info(f"Seed: {os.getenv('SEED', '42')}")
logger.info(f"Risk Oracle Address: {RISK_ORACLE_ADDR}")

@app.get("/v1/health")
def health():
    return {"status": "ok", "oracle": RISK_ORACLE_ADDR}

@app.post("/v1/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    """Score risk for an obligor"""
    # Score the risk
    score_result = score_risk(req.features, req.obligorId)
    
    return ScoreResponse(
        obligorId=req.obligorId,
        tenorDays=req.tenorDays,
        asOf=req.asOf,
        pdBps=score_result['pdBps'],
        lgdBps=score_result['lgdBps'],
        scoreConfidence=score_result['scoreConfidence']
    )

@app.post("/v1/price", response_model=PriceResponse)
def price(req: PriceRequest):
    """Price CDS for an obligor"""
    # First score the risk
    score_result = score_risk(req.features, req.obligorId)
    
    # Then price the CDS
    price_result = price_cds(
        req.obligorId, 
        req.tenorDays, 
        req.features, 
        score_result['pdBps'], 
        score_result['lgdBps']
    )
    
    # Generate dummy digest and signature for now
    digest = generate_dummy_digest(req.obligorId, req.asOf)
    signature = generate_dummy_signature(req.obligorId, req.asOf)
    
    return PriceResponse(
        obligorId=req.obligorId,
        tenorDays=req.tenorDays,
        asOf=req.asOf,
        notional=req.notional,
        fairSpreadBps=price_result['fairSpreadBps'],
        correlationBps=price_result['correlationBps'],
        digest=digest,
        signature=signature
    )

# Run locally: uvicorn app:app --reload --port 8001
