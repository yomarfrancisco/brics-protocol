# Off-chain Engine (skeleton)
Run:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Wire this service to your on-chain readers (ethers.js or web3.py) and your signer tools for NAV quorum signing and emergency updates.
