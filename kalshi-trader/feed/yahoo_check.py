from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Optional

logger = logging.getLogger("kalshi_trader.feed")

# Same unauthenticated Yahoo Finance chart API the backtest engine already uses
# (backtest/ingest/fetch_yahoo.py) - an independent data source from the Coinbase
# WebSocket feed driving the actual signal, used here purely to cross-check for
# basis risk (a real Coinbase-specific move that other venues didn't share, or a
# feed bug), not as a second trading input.
_URL = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1m&range=1d"


def fetch_btc_price_yahoo() -> Optional[float]:
    req = urllib.request.Request(_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
        return float(data["chart"]["result"][0]["meta"]["regularMarketPrice"])
    except (urllib.error.URLError, KeyError, IndexError, TypeError, ValueError):
        logger.exception("Yahoo BTC price cross-check fetch failed")
        return None
