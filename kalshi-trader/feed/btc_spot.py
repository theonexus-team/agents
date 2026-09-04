from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncIterator

import websockets

logger = logging.getLogger("kalshi_trader.feed")

COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com"

# Signal-generation feed only. Kalshi settles against a 60-second average of the
# CF Benchmarks BTC Real-Time Index, not this feed - there is inherent basis risk
# between the two. Never use this feed to compute settlement PnL, only to drive
# the directional signal and to monitor the Kalshi contract's own price separately.


async def btc_ticks() -> AsyncIterator[tuple[datetime, float, float]]:
    """Yields (timestamp, price, last_size) forever, reconnecting with backoff on drop."""
    backoff = 1
    while True:
        try:
            async with websockets.connect(COINBASE_WS_URL, ping_interval=20) as ws:
                await ws.send(json.dumps({
                    "type": "subscribe",
                    "product_ids": ["BTC-USD"],
                    "channels": ["ticker"],
                }))
                backoff = 1
                async for raw in ws:
                    msg = json.loads(raw)
                    if msg.get("type") != "ticker" or "price" not in msg:
                        continue
                    ts = datetime.now(timezone.utc)
                    price = float(msg["price"])
                    size = float(msg.get("last_size", 0.0))
                    yield ts, price, size
        except (websockets.ConnectionClosed, OSError) as exc:
            logger.warning("btc_spot feed dropped (%s), reconnecting in %ss", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
