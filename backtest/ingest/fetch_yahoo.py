"""Pulls recent 1-minute OHLCV bars from Yahoo Finance's public chart API — the same
unauthenticated source src/lib/providers/yahoo.ts already uses for the live dashboard's
Price Data Health panel, just here for history instead of a single live quote.

Yahoo's real practical limit for 1-minute granularity is well short of the ~60 days
its docs sometimes imply — empirically closer to 3-4 weeks (verified: 20 days back
still returns data, 30 days back 422s). This chunks into 5-day windows (Yahoo also
silently truncates any SINGLE request to about a week of 1m bars regardless of the
requested range) and stitches them together, treating a 422'd window as "no data
that far back" rather than failing the whole fetch. Good enough for a real (if
short) forward-test/sanity-check window while a proper multi-year TradingView CSV
export is still pending; nowhere near "several years."
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
#: src/lib/providers/yahoo.ts exactly (micro contracts track the full-size
#: contract's price 1:1 per point, so the full-size ticker is a faithful reference).
YAHOO_TICKER = {"MGC": "GC=F", "HG": "HG=F", "MNQ": "NQ=F"}


def _fetch_window(ticker: str, period1: int, period2: int) -> pd.DataFrame:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval=1m&period1={period1}&period2={period2}&includePrePost=false"
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


def fetch_yahoo_1m_csv(symbol: str, days: int = 60) -> Path:
    """Fetches up to `days` days of 1-minute bars and writes them to a temp CSV in
    the exact shape ingest/import_csv.py already parses (time,open,high,low,close,
    volume with epoch-second timestamps) — so this goes through the identical
    dedupe/partition path as a real TradingView export, no separate code path."""
    ticker = YAHOO_TICKER[symbol]
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    frames = []
    window_start = start
    while window_start < now:
        window_end = min(window_start + timedelta(days=5), now)
        df = _fetch_window(ticker, int(window_start.timestamp()), int(window_end.timestamp()))
        if not df.empty:
            frames.append(df)
        window_start = window_end

    if not frames:
        raise RuntimeError(f"Yahoo returned no 1m bars for {ticker} ({symbol}) in the last {days} days.")

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

    csv_path = Path(tempfile.gettempdir()) / f"yahoo_{symbol}_1m_{now:%Y%m%d%H%M%S}.csv"
    out.to_csv(csv_path, index=False)
    return csv_path
