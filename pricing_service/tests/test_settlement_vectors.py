import json
from pathlib import Path
import math

def round_half_up(numer, denom):
    if numer >= 0:
        return (numer + denom // 2) // denom
    else:
        return -(((-numer) + denom // 2) // denom)

def compute_pnl_smallest(fair_bps, fixed_bps, notional, elapsed_days, tenor_days):
    delta_bps = fair_bps - fixed_bps
    numer = delta_bps * notional * elapsed_days
    denom = 10000 * tenor_days
    return round_half_up(numer, denom)

def test_golden_vectors_parity():
    vectors = json.loads(Path("tests/golden/settlement_vectors.json").read_text())
    for v in vectors:
        got = compute_pnl_smallest(
            v["fairSpreadBps"], v["fixedSpreadBps"], v["notional"], v["elapsedDays"], v["tenorDays"]
        )
        assert got == v["expectedPnlSmallest"], f"{v['name']}: got {got}, expected {v['expectedPnlSmallest']}"

if __name__ == "__main__":
    test_golden_vectors_parity()
    print("✅ All golden vectors pass parity test")
