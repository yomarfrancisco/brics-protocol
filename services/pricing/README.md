# BRICS Pricing Service v0.1

AI Risk Scoring API and CDS Pricing Engine for the BRICS Protocol.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp env.example .env

# Edit .env with your configuration
# RISK_ORACLE_PRIVATE_KEY=0x...  # Your private key
# PORT=8001
# MODEL=baseline-v0
# SEED=42
```

## Run

```bash
# Start the API server
uvicorn app:app --reload --port 8001
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8001/v1/health
```

### Risk Scoring
```bash
curl -X POST http://localhost:8001/v1/score \
  -H "Content-Type: application/json" \
  -d '{
    "obligorId": "BANK001",
    "tenorDays": 365,
    "asOf": 1700000000,
    "features": {
      "size": 0.5,
      "leverage": 0.3,
      "volatility": 0.4,
      "fxExposure": 0.2,
      "countryRisk": 0.1,
      "industryStress": 0.2,
      "collateralQuality": 0.7,
      "dataQuality": 0.8,
      "modelShift": 0.1
    }
  }'
```

### CDS Pricing
```bash
curl -X POST http://localhost:8001/v1/price \
  -H "Content-Type: application/json" \
  -d '{
    "obligorId": "BANK001",
    "tenorDays": 365,
    "asOf": 1700000000,
    "notional": 1000000,
    "modelId": "baseline-v0",
    "features": {
      "size": 0.5,
      "leverage": 0.3,
      "volatility": 0.4,
      "fxExposure": 0.2,
      "countryRisk": 0.1,
      "industryStress": 0.2,
      "collateralQuality": 0.7,
      "dataQuality": 0.8,
      "modelShift": 0.1
    }
  }'
```

## CLI Usage

### Price a CDS
```bash
python cli.py price --obligor BANK001 --tenor 365 --asof now --notional 1000000
```

### Score Risk
```bash
python cli.py score --obligor BANK001 --tenor 365 --asof now
```

### With Custom Features
```bash
python cli.py price --obligor BANK001 --tenor 365 --asof now --notional 1000000 \
  --features '{"size": 0.8, "leverage": 0.6, "volatility": 0.7}'
```

## Testing

```bash
# Run all tests
pytest tests/

# Run smoke tests
python tests/test_smoke.py
```

## Baseline Model (v0.1)

The baseline model provides deterministic risk scoring and CDS pricing:

### Risk Scoring Formula
- **PD (Probability of Default)**: `50*size + 80*leverage + 40*volatility + 30*fxExposure + 20*countryRisk + jitter`
- **LGD (Loss Given Default)**: `4500 + 10*industryStress - 5*collateralQuality`
- **Confidence**: `0.50 + 0.05*dataQuality - 0.03*modelShift`

### CDS Pricing Formula
- **Expected Loss**: `(PD * LGD) / 10000`
- **Liquidity Premium**: `5 + 0.02*tenorDays + jitter`
- **Risk Premium**: `0.6 * sqrt(max(PD, 1))`
- **Fair Spread**: `EL + liquidity + risk_premium`
- **Correlation**: `(15 + 2.5*volatility + 1.5*countryRisk) * 100`

### Deterministic Outputs
All outputs are deterministic for fixed inputs and SEED value. The model includes controlled jitter to simulate real-world variability while maintaining reproducibility.

## Environment Variables

- `RISK_ORACLE_PRIVATE_KEY`: Private key for signing (optional, generates ephemeral if not set)
- `PORT`: Server port (default: 8001)
- `MODEL`: Model identifier (default: baseline-v0)
- `SEED`: Seed for deterministic outputs (default: 42)

## Next Steps

- [ ] Implement real ECDSA signing with on-chain parity
- [ ] Add XGBoost model integration
- [ ] Implement portfolio-level risk aggregation
- [ ] Add market data feeds
