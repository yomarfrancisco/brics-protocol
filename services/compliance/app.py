"""
BRICS Compliance Service - KYC/AML API
"""
import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .schemas import KYCRequest, KYCResponse, AMLRequest, AMLResponse, redact_log_data
from .adapters.mock_provider import MockComplianceProvider

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BRICS Compliance Service v0.1",
    description="KYC/AML compliance API with deterministic mock responses",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize mock provider
seed = os.getenv('SEED', '')
provider = MockComplianceProvider(seed=seed)

@app.get("/v1/health")
def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "compliance",
        "provider": "mock",
        "seed": seed
    }

@app.post("/v1/kyc/check", response_model=KYCResponse)
def check_kyc(request: KYCRequest):
    """
    Perform KYC check for a subject
    
    This endpoint provides deterministic mock responses for testing.
    No PII is persisted or logged.
    """
    try:
        # Log request with redacted data
        log_data = request.model_dump()
        redacted_data = redact_log_data(log_data)
        logger.info(f"KYC check request: {redacted_data}")
        
        # Perform KYC check
        result = provider.check_kyc(
            subject_id=request.subjectId,
            name=request.name,
            dob=request.dob,
            docType=request.docType,
            docLast4=request.docLast4
        )
        
        # Return response
        return KYCResponse(**result)
        
    except Exception as e:
        logger.error(f"KYC check error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/v1/aml/screen", response_model=AMLResponse)
def screen_aml(request: AMLRequest):
    """
    Perform AML screening for a subject
    
    This endpoint provides deterministic mock responses for testing.
    No PII is persisted or logged.
    """
    try:
        # Log request
        logger.info(f"AML screening request: {request.model_dump()}")
        
        # Perform AML screening
        result = provider.screen_aml(subject_id=request.subjectId)
        
        # Return response
        return AMLResponse(**result)
        
    except Exception as e:
        logger.error(f"AML screening error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
