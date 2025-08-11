# ADR-0003: KYC/AML Interface for BRICS Protocol

## Status

Accepted

## Context

The BRICS Protocol requires Know Your Customer (KYC) and Anti-Money Laundering (AML) compliance capabilities to meet regulatory requirements. The interface must be secure, privacy-preserving, and integrate with external compliance providers while maintaining data minimization principles.

## Decision

We will implement a compliance service with stubbed endpoints that provide deterministic, testable responses without persisting PII or making external network calls. The service will define clear interfaces for future integration with real compliance providers.

## Consequences

### Positive
- **Privacy-first**: No PII storage in repository or logs
- **Deterministic**: Testable responses for development and CI
- **Extensible**: Clear interfaces for future provider integration
- **Compliant**: Data minimization and retention policies enforced

### Negative
- **Limited functionality**: Stubbed responses only (no real compliance checks)
- **Manual integration**: Future providers require custom adapter implementation
- **Testing overhead**: Need to maintain deterministic test vectors

## Technical Specification

### Data Minimization Principles

1. **No PII Storage**: Personal information is never persisted to disk or logs
2. **Redacted Logging**: Sensitive fields are redacted in all log outputs
3. **Ephemeral Processing**: PII exists only in memory during request processing
4. **Deterministic Responses**: Same inputs always produce same outputs for testing

### KYC Endpoint

**POST /v1/kyc/check**

**Request Schema**:
```json
{
  "subjectId": "string (required, 1-100 chars)",
  "name": "string (optional, 1-200 chars)",
  "dob": "string (optional, YYYY-MM-DD format)",
  "docType": "string (optional, passport|drivers_license|national_id)",
  "docLast4": "string (optional, exactly 4 digits)"
}
```

**Response Schema**:
```json
{
  "subjectId": "string",
  "status": "pass|review|fail",
  "reasons": ["string"],
  "confidence": "float (0.0-1.0)",
  "timestamp": "int (unix timestamp)"
}
```

### AML Endpoint

**POST /v1/aml/screen**

**Request Schema**:
```json
{
  "subjectId": "string (required, 1-100 chars)"
}
```

**Response Schema**:
```json
{
  "subjectId": "string",
  "status": "clear|hit",
  "lists": ["string"],
  "score": "int (0-100)",
  "timestamp": "int (unix timestamp)"
}
```

### Deterministic Mock Implementation

The service uses deterministic hashing to generate consistent responses:

```python
def deterministic_kyc_status(subject_id: str, seed: str = "") -> dict:
    """Generate deterministic KYC status based on subject ID"""
    hash_input = f"kyc:{subject_id}:{seed}"
    hash_bytes = keccak(to_bytes(text=hash_input))
    
    # Use hash to determine status
    status_value = int.from_bytes(hash_bytes[:4], 'big') % 3
    status_map = {0: "pass", 1: "review", 2: "fail"}
    
    return {
        "status": status_map[status_value],
        "confidence": (int.from_bytes(hash_bytes[4:8], 'big') % 100) / 100.0,
        "reasons": ["deterministic_mock_response"]
    }
```

### Logging and Redaction

Sensitive fields are automatically redacted:

```python
LOG_REDACTED_FIELDS = ["name", "dob", "docLast4"]

def redact_log_data(data: dict) -> dict:
    """Redact sensitive fields for logging"""
    redacted = data.copy()
    for field in LOG_REDACTED_FIELDS:
        if field in redacted:
            redacted[field] = "[REDACTED]"
    return redacted
```

### Error Handling

**HTTP Status Codes**:
- **200**: Success
- **422**: Validation error (invalid schema)
- **429**: Rate limit exceeded
- **500**: Internal server error

**Rate Limiting**:
- **KYC**: 10 requests per minute per subjectId
- **AML**: 20 requests per minute per subjectId

### Golden Vectors

For deterministic testing, use these inputs:

**KYC Golden Vector**:
```json
{
  "subjectId": "ALPHA-001",
  "name": "John Doe",
  "dob": "1990-01-01",
  "docType": "passport",
  "docLast4": "1234"
}
```

**Expected Response** (with SEED=""):
```json
{
  "subjectId": "ALPHA-001",
  "status": "fail",
  "reasons": ["deterministic_mock_response", "document_validation_failed"],
  "confidence": 0.26,
  "timestamp": 1726000000
}
```

**AML Golden Vector**:
```json
{
  "subjectId": "ALPHA-001"
}
```

**Expected Response** (with SEED=""):
```json
{
  "subjectId": "ALPHA-001",
  "status": "clear",
  "lists": ["ofac", "un", "eu_sanctions"],
  "score": 86,
  "timestamp": 1726000000
}
```

## Security Considerations

1. **Data Minimization**: Only collect necessary fields for compliance
2. **Redacted Logging**: Never log PII in any form
3. **Input Validation**: Strict schema validation with length limits
4. **Rate Limiting**: Prevent abuse and ensure fair usage
5. **No Persistence**: PII never written to disk or database

## Future Provider Integration

When integrating real compliance providers:

1. **Adapter Pattern**: Implement provider-specific adapters
2. **Interface Compliance**: Ensure responses match defined schemas
3. **Error Handling**: Graceful degradation for provider failures
4. **Audit Trail**: Log compliance decisions (without PII)
5. **Configuration**: Provider selection via environment variables

## Implementation Notes

- Use FastAPI for API framework
- Implement Pydantic v2 schemas with strict validation
- Add comprehensive test suite with golden vectors
- Include CLI for testing and development
- Set up CI job with deterministic artifacts
- Document provider integration patterns

## Testing Requirements

1. **Schema Validation**: Test all field constraints and patterns
2. **Determinism**: Verify identical inputs produce identical outputs
3. **Redaction**: Ensure sensitive fields are never logged
4. **Error Handling**: Test 422, 429, and 500 responses
5. **Golden Vectors**: Validate against known test cases
