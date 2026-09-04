from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import duckdb
import pandas as pd

from engine.bars_store import DATA_DIR, partition_path

INGEST_LOG_PATH = DATA_DIR / "ingest_log.duckdb"


@dataclass
class IngestResult:
    skipped: bool
    reason: Optional[str] = None
    rows_ingested: int = 0
    duplicates_skipped: int = 0
    min_ts: Optional[datetime] = None
    max_ts: Optional[datetime] = None


def _log_conn() -> duckdb.DuckDBPyConnection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(INGEST_LOG_PATH))
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS ingest_log (
            file_name TEXT, symbol TEXT, timeframe TEXT, row_count BIGINT,
            min_ts TIMESTAMP, max_ts TIMESTAMP, ingested_at TIMESTAMP, content_hash TEXT
        )
        """
    )
    return con


def _parse_tradingview_csv(csv_path: Path) -> pd.DataFrame:
    """Best-effort parser for TradingView's "Export chart data" CSV. NOT yet verified
    against a real export (none was available while building this) — auto-detects
    whether the time column is Unix epoch seconds (numeric) or an ISO-ish date string,
    and assumes UTC once parsed. Verify column names/timezone against a real file and
    adjust this function before trusting results built from real exports."""
    raw = pd.read_csv(csv_path)
    raw.columns = [c.strip().lower() for c in raw.columns]

    time_col = "time" if "time" in raw.columns else raw.columns[0]
    if pd.api.types.is_numeric_dtype(raw[time_col]):
        ts = pd.to_datetime(raw[time_col], unit="s", utc=True)
    else:
        ts = pd.to_datetime(raw[time_col], utc=True)

    df = pd.DataFrame(
        {
            "ts": ts,
            "open": raw["open"].astype(float),
            "high": raw["high"].astype(float),
            "low": raw["low"].astype(float),
            "close": raw["close"].astype(float),
            "volume": raw["volume"].astype(float) if "volume" in raw.columns else pd.Series([None] * len(raw)),
        }
    )
    return df.dropna(subset=["ts", "open", "high", "low", "close"]).sort_values("ts").reset_index(drop=True)


def ingest_csv(csv_path: Path, symbol: str, timeframe: str) -> IngestResult:
    content_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    log = _log_conn()
    already = log.execute("SELECT 1 FROM ingest_log WHERE content_hash = ?", [content_hash]).fetchone()
    if already:
        log.close()
        return IngestResult(skipped=True, reason=f"{csv_path.name} already ingested (identical file content)")

    df = _parse_tradingview_csv(csv_path)
    if df.empty:
        log.close()
        return IngestResult(skipped=True, reason="no valid rows parsed from file")

    df["year"] = df["ts"].dt.year
    total_dupes = 0

    for year, group in df.groupby("year"):
        part_path = partition_path(symbol, timeframe, int(year))
        part_path.parent.mkdir(parents=True, exist_ok=True)
        new_rows = group.drop(columns=["year"]).sort_values("ts").reset_index(drop=True)

        if part_path.exists():
            existing = pd.read_parquet(part_path)
            overlap = existing.merge(new_rows, on="ts", suffixes=("_old", "_new"))
            if not overlap.empty:
                mismatched = overlap[
                    (overlap["open_old"].round(6) != overlap["open_new"].round(6))
                    | (overlap["high_old"].round(6) != overlap["high_new"].round(6))
                    | (overlap["low_old"].round(6) != overlap["low_new"].round(6))
                    | (overlap["close_old"].round(6) != overlap["close_new"].round(6))
                ]
                if not mismatched.empty:
                    print(
                        f"WARNING: {len(mismatched)} bar(s) in {year} have OHLC values that "
                        f"disagree between the existing store and {csv_path.name} at the same "
                        f"timestamp. Keeping {csv_path.name}'s values. This usually means the "
                        f"two exports used different chart settings — spot-check before trusting "
                        f"backtests spanning this period."
                    )
                total_dupes += len(overlap)
            combined = pd.concat([existing, new_rows], ignore_index=True).drop_duplicates(subset="ts", keep="last")
        else:
            combined = new_rows

        combined = combined.sort_values("ts").reset_index(drop=True)
        combined.to_parquet(part_path, index=False)

    log.execute(
        "INSERT INTO ingest_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            csv_path.name,
            symbol,
            timeframe,
            len(df),
            df["ts"].min().to_pydatetime(),
            df["ts"].max().to_pydatetime(),
            datetime.now(timezone.utc),
            content_hash,
        ],
    )
    log.close()

    return IngestResult(
        skipped=False,
        rows_ingested=len(df) - total_dupes,
        duplicates_skipped=total_dupes,
        min_ts=df["ts"].min().to_pydatetime(),
        max_ts=df["ts"].max().to_pydatetime(),
    )
