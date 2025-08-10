from fastapi import FastAPI
from pydantic import BaseModel
from enum import Enum

app = FastAPI(title="BRICS Off-chain Engine")

class EmergencyLevel(int, Enum):
    NORMAL=0; YELLOW=1; ORANGE=2; RED=3

class Nav(BaseModel):
    nav: float
    ts: int
    model_hash: str

@app.get("/nav/latest", response_model=Nav)
def nav_latest():
    # TODO: wire to signer service / DB
    return Nav(nav=1.000_000, ts=0, model_hash="0x...")

@app.get("/emergency/level")
def emergency_level():
    # TODO: compute from aggregates; placeholder NORMAL
    return {"level": EmergencyLevel.NORMAL, "triggers": [], "time_in_state": 0}

@app.get("/emergency/buffers")
def buffers():
    # TODO: fetch on-chain treasury/pretranche balances; placeholder
    return {"pre_tranche": 10_000_000, "irb": 0, "targets": {"pre": 10_000_000, "irb": 0.03}, "health": True}

@app.get("/emergency/detachment")
def detachment():
    # TODO: read from TrancheManagerV2
    return {"current": {"lo": 10000, "hi": 10200}, "ratified": {"lo": 10000, "hi": 10200}, "deadline": 0, "extension_used": False}

@app.get("/governance/proposal/votes")
def votes():
    return {"yes_votes": 0, "total_votes": 0, "support_pct": 0}
