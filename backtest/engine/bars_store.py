from __future__ import annotations

import glob
from datetime import datetime
from pathlib import Path
from typing import Optional

import duckdb

from .bar import Bar

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
BARS_DIR = DATA_DIR / "bars"


def partition_path(symbol: str, timeframe: str, year: int) -> Path:
    return BARS_DIR / f"symbol={symbol}" / f"timeframe={timeframe}" / f"year={year}" / "part.parquet"


def _glob_pattern(symbol: str, timeframe: str) -> str:
    return str(BARS_DIR / f"symbol={symbol}" / f"timeframe={timeframe}" / "year=*" / "part.parquet")


def has_any_bars(symbol: str, timeframe: str) -> bool:
    return len(glob.glob(_glob_pattern(symbol, timeframe))) > 0


def read_bars(
    symbol: str,
    timeframe: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[Bar]:
    """All bars for symbol/timeframe within [start, end] (inclusive), sorted
    ascending by ts. Reads directly off Parquet via DuckDB — no separate import step
    beyond what ingest/import_csv.py already wrote."""
    if not has_any_bars(symbol, timeframe):
        return []

    con = duckdb.connect()
    con.execute("SET TimeZone='UTC'")
    query = "SELECT ts, open, high, low, close, volume FROM read_parquet(?) WHERE 1=1"
    params: list = [_glob_pattern(symbol, timeframe)]
    if start is not None:
        query += " AND ts >= ?"
        params.append(start)
    if end is not None:
        query += " AND ts <= ?"
        params.append(end)
    query += " ORDER BY ts"

    rows = con.execute(query, params).fetchall()
    con.close()
    return [Bar(ts=r[0], open=r[1], high=r[2], low=r[3], close=r[4], volume=r[5]) for r in rows]


def coverage(symbol: str, timeframe: str) -> Optional[tuple[datetime, datetime, int]]:
    """(min_ts, max_ts, row_count) across all partitions, or None if nothing ingested."""
    if not has_any_bars(symbol, timeframe):
        return None
    con = duckdb.connect()
    con.execute("SET TimeZone='UTC'")
    row = con.execute(
        "SELECT min(ts), max(ts), count(*) FROM read_parquet(?)",
        [_glob_pattern(symbol, timeframe)],
    ).fetchone()
    con.close()
    if row is None or row[0] is None:
        return None
    return (row[0], row[1], row[2])
