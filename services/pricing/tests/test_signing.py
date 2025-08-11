from crypto import load_or_create_key, sign_digest
from eth_utils import keccak

def test_sign_and_length():
    pk = load_or_create_key()
    d = keccak(b'abc')
    sig = sign_digest(pk, d)
    assert sig.startswith('0x') and len(bytes.fromhex(sig[2:])) == 65
