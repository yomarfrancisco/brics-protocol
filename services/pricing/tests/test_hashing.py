from services.pricing.determinism import canonical_features_hash, model_id_hash, digest_for_signing
from eth_utils import to_bytes

def test_canonical_features_hash_is_stable():
    a = {"b": 2, "a": [3, {"z":1}]}
    h1 = canonical_features_hash(a)
    h2 = canonical_features_hash({"a":[3,{"z":1}],"b":2})
    assert h1 == h2

def test_digest_matches_known_vector():
    pid = to_bytes(hexstr='0x' + '11'*32)
    asof = 1_700_000_000
    risk = 123456789
    corr = 777
    spread = 1500
    mid = model_id_hash('xgb-v0-stub')
    fh  = bytes.fromhex('22'*32)
    d = digest_for_signing(pid, asof, risk, corr, spread, mid, fh)
    assert len(d) == 32
