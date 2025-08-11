"""
Mock provider adapter for KYC/AML compliance service
"""
from typing import Dict, Any
from ..rules import deterministic_kyc_status, deterministic_aml_status, get_current_timestamp
from ..schemas import redact_log_data
import logging

logger = logging.getLogger(__name__)

class MockComplianceProvider:
    """Mock compliance provider for testing and development"""
    
    def __init__(self, seed: str = ""):
        self.seed = seed
    
    def check_kyc(self, subject_id: str, **kwargs) -> Dict[str, Any]:
        """
        Mock KYC check
        
        Args:
            subject_id: Subject identifier
            **kwargs: Additional KYC data (name, dob, docType, docLast4)
        
        Returns:
            KYC check result
        """
        # Log request with redacted data
        log_data = {"subjectId": subject_id, **kwargs}
        redacted_data = redact_log_data(log_data)
        logger.info(f"Mock KYC check: {redacted_data}")
        
        # Generate deterministic response
        result = deterministic_kyc_status(subject_id, self.seed)
        result["subjectId"] = subject_id
        result["timestamp"] = get_current_timestamp()
        
        # Log response (no PII)
        logger.info(f"Mock KYC result: {result}")
        
        return result
    
    def screen_aml(self, subject_id: str) -> Dict[str, Any]:
        """
        Mock AML screening
        
        Args:
            subject_id: Subject identifier
        
        Returns:
            AML screening result
        """
        # Log request
        logger.info(f"Mock AML screening: {{'subjectId': '{subject_id}'}}")
        
        # Generate deterministic response
        result = deterministic_aml_status(subject_id, self.seed)
        result["subjectId"] = subject_id
        result["timestamp"] = get_current_timestamp()
        
        # Log response
        logger.info(f"Mock AML result: {result}")
        
        return result
