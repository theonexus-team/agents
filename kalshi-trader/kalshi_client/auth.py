from __future__ import annotations

import base64
import time
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

import config


@lru_cache(maxsize=1)
def load_private_key() -> RSAPrivateKey:
    if not config.KALSHI_PRIVATE_KEY_PATH:
        raise RuntimeError("KALSHI_PRIVATE_KEY_PATH is not set")
    with open(config.KALSHI_PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def sign(method: str, path_without_query: str) -> tuple[str, str]:
    """Returns (timestamp_ms, base64_signature). Message = timestamp + METHOD + path,
    path is the full URL path from root (e.g. /trade-api/v2/portfolio/balance), no query string.
    Verified verbatim against docs.kalshi.com/getting_started/quick_start_authenticated_requests."""
    timestamp = str(int(time.time() * 1000))
    message = f"{timestamp}{method}{path_without_query}".encode("utf-8")
    signature = load_private_key().sign(
        message,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
        hashes.SHA256(),
    )
    return timestamp, base64.b64encode(signature).decode("utf-8")


def auth_headers(method: str, path_without_query: str) -> dict[str, str]:
    timestamp, signature = sign(method, path_without_query)
    return {
        "KALSHI-ACCESS-KEY": config.KALSHI_KEY_ID,
        "KALSHI-ACCESS-SIGNATURE": signature,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
    }
