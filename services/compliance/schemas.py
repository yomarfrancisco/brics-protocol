from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import re
from datetime import datetime

# Fields that should be redacted in logs
LOG_REDACTED_FIELDS = ["name", "dob", "docLast4"]

class KYCRequest(BaseModel):
    subjectId: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        description="Subject identifier (1-100 characters)"
    )
    name: Optional[str] = Field(
        None,
        min_length=1, 
        max_length=200,
        description="Full name (optional, 1-200 characters)"
    )
    dob: Optional[str] = Field(
        None,
        description="Date of birth in YYYY-MM-DD format"
    )
    docType: Optional[str] = Field(
        None,
        description="Document type"
    )
    docLast4: Optional[str] = Field(
        None,
        description="Last 4 digits of document number"
    )
    
    @field_validator('subjectId')
    @classmethod
    def validate_subject_id(cls, v):
        if not re.match(r'^[A-Za-z0-9\-_\.]+$', v):
            raise ValueError('Subject ID must contain only alphanumeric characters, hyphens, underscores, and dots')
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not re.match(r'^[A-Za-z\s\-\.]+$', v):
                raise ValueError('Name must contain only letters, spaces, hyphens, and dots')
        return v
    
    @field_validator('dob')
    @classmethod
    def validate_dob(cls, v):
        if v is not None:
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
                raise ValueError('Date of birth must be in YYYY-MM-DD format')
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Invalid date format')
        return v
    
    @field_validator('docType')
    @classmethod
    def validate_doc_type(cls, v):
        if v is not None:
            valid_types = ["passport", "drivers_license", "national_id"]
            if v not in valid_types:
                raise ValueError(f'Document type must be one of: {", ".join(valid_types)}')
        return v
    
    @field_validator('docLast4')
    @classmethod
    def validate_doc_last4(cls, v):
        if v is not None:
            if not re.match(r'^\d{4}$', v):
                raise ValueError('Document last 4 must be exactly 4 digits')
        return v

class KYCResponse(BaseModel):
    subjectId: str
    status: str = Field(
        ...,
        description="KYC status"
    )
    reasons: List[str] = Field(
        ...,
        description="List of reasons for the status"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score (0.0-1.0)"
    )
    timestamp: int = Field(
        ...,
        description="Unix timestamp"
    )
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ["pass", "review", "fail"]
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

class AMLRequest(BaseModel):
    subjectId: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        description="Subject identifier (1-100 characters)"
    )
    
    @field_validator('subjectId')
    @classmethod
    def validate_subject_id(cls, v):
        if not re.match(r'^[A-Za-z0-9\-_\.]+$', v):
            raise ValueError('Subject ID must contain only alphanumeric characters, hyphens, underscores, and dots')
        return v

class AMLResponse(BaseModel):
    subjectId: str
    status: str = Field(
        ...,
        description="AML status"
    )
    lists: List[str] = Field(
        ...,
        description="List of screening lists checked"
    )
    score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Risk score (0-100)"
    )
    timestamp: int = Field(
        ...,
        description="Unix timestamp"
    )
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ["clear", "hit"]
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

def redact_log_data(data: dict) -> dict:
    """Redact sensitive fields for logging"""
    redacted = data.copy()
    for field in LOG_REDACTED_FIELDS:
        if field in redacted:
            redacted[field] = "[REDACTED]"
    return redacted
