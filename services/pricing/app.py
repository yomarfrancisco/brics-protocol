import os
from fastapi import FastAPI
from dotenv import load_dotenv
from eth_utils import to_bytes
from schemas import PriceRequest, PriceResponse
from determinism import canonical_features_hash, model_id_hash, compute_outputs, digest_for_signing
from crypto import load_or_create_key, sign_digest, public_address

load_dotenv()
app = FastAPI(title="BRICS Pricing v0.1")

ORACLE_PK = load_or_create_key()
ORACLE_ADDR = os.getenv('ORACLE_ADDRESS') or public_address(ORACLE_PK)

@app.get("/v1/health")
def health():
    return {"ok": True, "oracle": ORACLE_ADDR}

@app.post("/v1/price", response_model=PriceResponse)
def price(req: PriceRequest):
    # Parse inputs
    portfolio_id = to_bytes(hexstr=req.portfolioId)
    assert len(portfolio_id) == 32, "portfolioId must be 32 bytes"
    fh = canonical_features_hash(req.features)
    mid = model_id_hash(req.modelId)

    # Deterministic outputs
    outs = compute_outputs(portfolio_id, req.asOf, fh)

    # Digest & signature
    digest = digest_for_signing(
        portfolio_id, req.asOf,
        outs['riskScore'],
        outs['correlationBps'],
        outs['spreadBps'],
        mid, fh
    )
    sig = sign_digest(ORACLE_PK, digest)

    return PriceResponse(
        asOf=req.asOf,
        riskScore=str(outs['riskScore']),
        correlationBps=outs['correlationBps'],
        spreadBps=outs['spreadBps'],
        modelId=req.modelId,
        digest='0x' + digest.hex(),
        signature=sig,
        portfolioId=req.portfolioId,
        featuresHash='0x' + fh.hex()
    )

# Run locally: uvicorn app:app --reload --port 8001
