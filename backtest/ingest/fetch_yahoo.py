"""Pulls recent OHLCV bars from Yahoo Finance's public chart API — the same
unauthenticated source src/lib/providers/yahoo.ts already uses for the live dashboard's
Price Data Health panel, just here for history instead of a single live quote.

Yahoo's real practical lookback varies a lot by granularity — empirically, not just
per its docs (which are optimistic for 1m specifically): 1m is closer to 3-4 weeks
(verified: 20 days back still returns data, 30 days back 422s) despite docs implying
~60; 5m/15m/30m genuinely do get closer to 60 days; 60m reaches back roughly 2 years.
See INTERVAL_CONFIG below for the (max_days, chunk_days) used per interval — chunked
regardless of interval since Yahoo silently truncates any SINGLE request's range
(observed most aggressively at 1m), and a 422'd window is treated as "no data that
far back" rather than failing the whole fetch.
"""

from __future__ import annotations

import json
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

#: Continuous front-month futures tickers — matches YAHOO_TICKER in
#: src/lib/providers/yahoo.ts (the 3 originally onboarded instruments) plus the 4
#: Instrument Scout candidates added 2026-09-04 (see scout.py). Micro contracts track
#: the full-size contract's price 1:1 per point, so the full-size ticker is a
#: faithful reference for all of these.
YAHOO_TICKER = {
    "MGC": "GC=F",
    "HG": "HG=F",
    "MNQ": "NQ=F",
    "MYM": "YM=F",
    "M2K": "RTY=F",
    "MCL": "CL=F",
    "SIL": "SI=F",
}

#: (max total lookback days, per-request chunk days) per Yahoo interval string.
#: Conservative on purpose — a request past the real limit just 422s and gets
#: treated as "no data," so erring smaller costs nothing but a slightly shorter
#: history; erring larger risks a slow trial-and-error discovery process instead.
INTERVAL_CONFIG = {
    "1m": (25, 5),
    "5m": (55, 55),
    "15m": (55, 55),
    "30m": (55, 55),
    "60m": (700, 90),
}


def _fetch_window(ticker: str, interval: str, period1: int, period2: int) -> pd.DataFrame:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval={interval}&period1={period1}&period2={period2}&includePrePost=false"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        # Yahoo's actual practical limit for 1m granularity is well short of the
        # ~60 days its docs imply (empirically closer to 3-4 weeks) — a window
        # older than that 422s rather than returning an empty result. Treat it the
        # same as "no data for this window" instead of failing the whole fetch.
        if e.code == 422:
            return pd.DataFrame(columns=["ts", "open", "high", "low", "close", "volume"])
        raise

    result = data.get("chart", {}).get("result")
    if not result:
        return pd.DataFrame(columns=["ts", "open", "high", "low", "close", "volume"])

    r = result[0]
    timestamps = r.get("timestamp") or []
    quote = (r.get("indicators") or {}).get("quote", [{}])[0]
    opens, highs, lows, closes, vols = (
        quote.get("open", []),
        quote.get("high", []),
        quote.get("low", []),
        quote.get("close", []),
        quote.get("volume", []),
    )

    rows = []
    for i, t in enumerate(timestamps):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        if None in (o, h, l, c):
            continue  # Yahoo leaves gaps (halts, thin overnight minutes) as nulls
        v = vols[i] if i < len(vols) and vols[i] is not None else 0
        rows.append((datetime.fromtimestamp(t, tz=timezone.utc), o, h, l, c, v))
    return pd.DataFrame(rows, columns=["ts", "open", "high", "low", "close", "volume"])


#: Maps our timeframe tags (used everywhere else in this engine — ingest, bars_store
#: partitioning, BacktestRun.timeframe) to Yahoo's own interval strings.
TIMEFRAME_TO_YAHOO_INTERVAL = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m"}


def fetch_yahoo_csv(symbol: str, timeframe: str = "1m", days: int | None = None) -> Path:
    """Fetches up to `days` days of bars at the given timeframe and writes them to a
    temp CSV in the exact shape ingest/import_csv.py already parses (time,open,high,
    low,close,volume with epoch-second timestamps) — so this goes through the
    identical dedupe/partition path as a real TradingView export, no separate code
    path. `days` defaults to the per-interval max in INTERVAL_CONFIG if omitted."""
    ticker = YAHOO_TICKER[symbol]
    interval = TIMEFRAME_TO_YAHOO_INTERVAL.get(timeframe)
    if interval is None:
        raise ValueError(f"Unsupported timeframe '{timeframe}' — expected one of {list(TIMEFRAME_TO_YAHOO_INTERVAL)}")
    max_days, chunk_days = INTERVAL_CONFIG[interval]
    days = days if days is not None else max_days

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    frames = []
    window_start = start
    while window_start < now:
        window_end = min(window_start + timedelta(days=chunk_days), now)
        df = _fetch_window(ticker, interval, int(window_start.timestamp()), int(window_end.timestamp()))
        if not df.empty:
            frames.append(df)
        window_start = window_end

    if not frames:
        raise RuntimeError(f"Yahoo returned no {timeframe} bars for {ticker} ({symbol}) in the last {days} days.")

    combined = pd.concat(frames, ignore_index=True).drop_duplicates(subset="ts").sort_values("ts")
    combined["ts"] = pd.to_datetime(combined["ts"], utc=True)

    out = combined.copy()
    # NOT .astype("int64") // 10**9 -- pandas' tz-aware datetime64 storage unit
    # varies by version (seen: microseconds here, not nanoseconds), so that divisor
    # is a silent 1000x-off landmine. Subtracting the epoch and dividing by a
    # Timedelta is unit-independent and always correct.
    epoch = pd.Timestamp("1970-01-01", tz="UTC")
    out["time"] = ((out["ts"] - epoch) // pd.Timedelta("1s")).astype(int)
    out = out[["time", "open", "high", "low", "close", "volume"]]

    csv_path = Path(tempfile.gettempdir()) / f"yahoo_{symbol}_{timeframe}_{now:%Y%m%d%H%M%S}.csv"
    out.to_csv(csv_path, index=False)
    return csv_path


# Kept for backwards compatibility — cli.py's existing `fetch-yahoo` command (and
# anything else already calling this name) still works unchanged.
def fetch_yahoo_1m_csv(symbol: str, days: int = 25) -> Path:
    return fetch_yahoo_csv(symbol, "1m", days)
