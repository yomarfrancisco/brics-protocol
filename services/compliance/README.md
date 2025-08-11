# BRICS Compliance Service v0.1

KYC/AML compliance API with deterministic mock responses for the BRICS Protocol.

## Overview

The Compliance Service provides Know Your Customer (KYC) and Anti-Money Laundering (AML) endpoints with deterministic mock responses for testing and development. No PII is persisted or logged.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment template (if needed)
# cp env.example .env
```

## Run

```bash
# Start the API server (from repo root)
PYTHONPATH=. uvicorn services.compliance.app:app --reload --port 8002

# Or from services/compliance directory
uvicorn app:app --reload --port 8002
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8002/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "compliance",
  "provider": "mock",
  "seed": ""
}
```

### KYC Check
```bash
curl -X POST http://localhost:8002/v1/kyc/check \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "ALPHA-001",
    "name": "John Doe",
    "dob": "1990-01-01",
    "docType": "passport",
    "docLast4": "1234"
  }'
```

**Response:**
```json
{
  "subjectId": "ALPHA-001",
  "status": "fail",
  "reasons": ["deterministic_mock_response", "document_validation_failed"],
  "confidence": 0.26,
  "timestamp": 1726000000
}
```

### AML Screening
```bash
curl -X POST http://localhost:8002/v1/aml/screen \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "ALPHA-001"
  }'
```

**Response:**
```json
{
  "subjectId": "ALPHA-001",
  "status": "clear",
  "lists": ["ofac", "un", "eu_sanctions"],
  "score": 86,
  "timestamp": 1726000000
}
```

## CLI Usage

### KYC Check (Golden Vector)
```bash
# From repo root
PYTHONPATH=. python -m services.compliance.cli kyc \
  --subject ALPHA-001 \
  --name "John Doe" \
  --dob "1990-01-01" \
  --doc-type passport \
  --doc-last4 1234 \
  --json-only
```

**Output:**
```json
{
  "subjectId": "ALPHA-001",
  "status": "fail",
  "reasons": ["deterministic_mock_response", "document_validation_failed"],
  "confidence": 0.26,
  "timestamp": 1726000000
}
```

### AML Screening
```bash
PYTHONPATH=. python -m services.compliance.cli aml \
  --subject ALPHA-001 \
  --json-only
```

**Output:**
```json
{
  "subjectId": "ALPHA-001",
  "status": "clear",
  "lists": ["ofac", "un", "eu_sanctions"],
  "score": 86,
  "timestamp": 1726000000
}
```

## Testing

```bash
# Run all tests (from repo root)
PYTHONPATH=. pytest services/compliance/tests -v

# Run specific test suites
PYTHONPATH=. pytest services/compliance/tests/test_compliance_api.py -v
```

## Deterministic Mock Responses

The service uses deterministic hashing to generate consistent responses:

### KYC Status Logic
- **Input**: `keccak("kyc:{subjectId}:{seed}")`
- **Status**: Hash bytes 0-3 mod 3 → `{0: "pass", 1: "review", 2: "fail"}`
- **Confidence**: Hash bytes 4-7 mod 100 / 100.0

### AML Status Logic
- **Input**: `keccak("aml:{subjectId}:{seed}")`
- **Status**: Hash bytes 0-3 mod 10 → `{0: "hit", else: "clear"}` (10% hit rate)
- **Score**: Hash bytes 4-7 mod 100

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SEED` | Seed for deterministic outputs | "" | No |
| `PORT` | Server port | 8002 | No |

### Example .env
```bash
# Deterministic mode (empty seed for testing)
SEED=""

# Server Configuration
PORT=8002
```

## Data Privacy

### Redacted Fields
The following fields are automatically redacted in logs:
- `name`
- `dob`
- `docLast4`

### No PII Persistence
- Personal information is never persisted to disk
- PII exists only in memory during request processing
- All responses are deterministic and contain no real PII

## Golden Vectors

For deterministic testing, use these inputs:

**KYC Golden Vector**:
- **Input**: `subjectId="ALPHA-001"` with `SEED=""`
- **Expected**: `status="fail"`, `confidence=0.26`

**AML Golden Vector**:
- **Input**: `subjectId="ALPHA-001"` with `SEED=""`
- **Expected**: `status="clear"`, `score=86`

## Error Handling

The API returns appropriate HTTP status codes:

- **200**: Success
- **422**: Validation error (invalid schema)
- **500**: Internal server error

### Example Error Response
```json
{
  "detail": [
    {
      "loc": ["body", "subjectId"],
      "msg": "Subject ID must contain only alphanumeric characters, hyphens, underscores, and dots",
      "type": "value_error"
    }
  ]
}
```

## Future Provider Integration

When integrating real compliance providers:

1. **Adapter Pattern**: Implement provider-specific adapters in `adapters/`
2. **Interface Compliance**: Ensure responses match defined schemas
3. **Error Handling**: Graceful degradation for provider failures
4. **Configuration**: Provider selection via environment variables
5. **Audit Trail**: Log compliance decisions (without PII)

## Security Considerations

1. **Data Minimization**: Only collect necessary fields for compliance
2. **Redacted Logging**: Never log PII in any form
3. **Input Validation**: Strict schema validation with length limits
4. **No Persistence**: PII never written to disk or database
5. **Deterministic Testing**: Reproducible responses for validation

## Next Steps

- [x] Implement deterministic mock responses
- [x] Add comprehensive validation and error handling
- [x] Create CLI for testing and development
- [ ] Integrate real compliance providers
- [ ] Add rate limiting and monitoring
- [ ] Implement audit trail (without PII)
