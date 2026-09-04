from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from kalshi_client import rest


def window_bounds(now: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """Returns (window_start, window_end) for the 15-min UTC window containing `now`.
    Used for the BTC-spot signal's own bookkeeping, independent of any specific
    Kalshi market object."""
    now = now or datetime.now(timezone.utc)
    floored_minute = (now.minute // 15) * 15
    start = now.replace(minute=floored_minute, second=0, microsecond=0)
    end = start + timedelta(minutes=15)
    return start, end


def get_current_market(series_ticker: str = "KXBTC15M") -> Optional[dict]:
    """Each KXBTC15M window is a single up/down market - 'floor_strike' is the
    reference price set at window open, 'strike_type' is 'greater_or_equal', so
    YES = price ends at/above the open reference (up), NO = below (down). There is
    no ladder of strikes to pick a 'nearest to spot' one from - confirmed against
    a real live market object, not assumed from docs. If more than one comes back
    (e.g. an overlapping close), picks the one closing soonest."""
    markets = rest.list_open_markets(series_ticker=series_ticker)
    if not markets:
        return None
    return min(markets, key=lambda m: m["close_time"])
