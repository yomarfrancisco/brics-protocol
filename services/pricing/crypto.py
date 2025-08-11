import os
from eth_utils import to_checksum_address
from eth_keys import keys

def load_or_create_key():
    pk_hex = os.getenv('ORACLE_PRIVATE_KEY')
    if not pk_hex:
        # create ephemeral key for local/dev; do NOT persist
        pk = keys.PrivateKey(os.urandom(32))
    else:
        pk = keys.PrivateKey(bytes.fromhex(pk_hex[2:] if pk_hex.startswith('0x') else pk_hex))
    return pk

def sign_digest(priv: keys.PrivateKey, digest: bytes) -> str:
    sig = priv.sign_msg_hash(digest)
    # 65-byte (r,s,v) → 0x...
    return '0x' + sig.to_bytes().hex()

def public_address(priv: keys.PrivateKey) -> str:
    return to_checksum_address(priv.public_key.to_checksum_address())
