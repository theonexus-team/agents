"""Instrument Scout — runs the two LIVE strategies (orb_vwap, algo2_first_touch)
against candidate instruments the live webhook doesn't trade yet, across several
timeframes, and writes every result to BacktestRun/BacktestTrade (source_note=
"Instrument Scout") in the shared Postgres DB — the same one the dashboard reads,
so results show up on /instrument-scout without any separate sync step.

Run from inside backtest/ with its venv active:
    python scout.py

Candidates and timeframes are fixed lists below rather than CLI flags — this is a
periodically-rerun research script, not a general-purpose tool; edit the lists
directly to change scope. Local-only: the raw bar data lives in local Parquet
files (see engine/bars_store.py), same constraint as the rest of this backtest
engine — there's no cloud-hosted equivalent of the price history itself, only of
the results computed from it.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone

from cli import INSTRUMENTS
from engine.bars_store import coverage, read_bars
from engine.db import get_conn, write_run
from engine.runner import BacktestRunner
from engine.strategy import FillTieBreak
from ingest.fetch_yahoo import fetch_yahoo_csv
from ingest.import_csv import ingest_csv
from strategies import STRATEGIES

SOURCE_NOTE = "Instrument Scout"

#: 2026-09-04: the 4 candidates picked (see conversation) — different asset-class
#: exposure than what's already live (MGC/HG/MNQ/MES): index (MYM, M2K), energy
#: (MCL), metal (SIL). hg_contracts=4 override below matches the "4 contracts" baseline
#: used for MNQ/MGC — algo2_first_touch.py has no generic non-MNQ/MGC contracts key,
#: it falls through to hg_contracts for anything else (see algo2_first_touch.py:52).
CANDIDATES = ["MYM", "M2K", "MCL", "SIL"]
TIMEFRAMES = ["5m", "15m", "30m", "1h"]
STRATEGY_PARAMS = {
    "orb_vwap": {},
    "algo2_first_touch": {"hg_contracts": 4},
}


def run_one(symbol: str, timeframe: str, strategy_name: str) -> None:
    instrument = INSTRUMENTS[symbol]

    print(f"  fetching {symbol}/{timeframe} from Yahoo...")
    try:
        csv_path = fetch_yahoo_csv(symbol, timeframe)
    except RuntimeError as e:
        print(f"    SKIP: {e}")
        return
    ingest_csv(csv_path, symbol, timeframe)

    cov = coverage(symbol, timeframe)
    if cov is None:
        print(f"    SKIP: no bars after ingest for {symbol}/{timeframe}")
        return
    start, end, bar_count = cov

    bars = read_bars(symbol, timeframe, start, end)
    if not bars:
        print(f"    SKIP: 0 bars in range for {symbol}/{timeframe}")
        return

    params = STRATEGY_PARAMS[strategy_name]
    strategy = STRATEGIES[strategy_name](params, instrument)
    runner = BacktestRunner(strategy, instrument, fill_tie_break=FillTieBreak.STOP_FIRST)
    trades = runner.run(bars)

    conn = get_conn()
    try:
        run_id = write_run(
            conn,
            strategy=strategy_name,
            instrument=instrument,
            timeframe=timeframe,
            mode="HISTORICAL",
            trades=trades,
            parameters={**params, "fill_tie_break": "stop_first"},
            source_note=SOURCE_NOTE,
            starting_balance=50000.0,
            data_start=start,
            data_end=end,
        )
    finally:
        conn.close()

    print(f"    {strategy_name}: {len(trades)} trade(s), {bar_count} bars ({start.date()} -> {end.date()}) -> run {run_id}")


def main() -> None:
    print(f"Instrument Scout run started {datetime.now(timezone.utc).isoformat()}")
    for symbol in CANDIDATES:
        if symbol not in INSTRUMENTS:
            print(f"Unknown symbol '{symbol}', skipping (add it to cli.py's INSTRUMENTS first)")
            continue
        for timeframe in TIMEFRAMES:
            print(f"{symbol} / {timeframe}")
            for strategy_name in STRATEGY_PARAMS:
                run_one(symbol, timeframe, strategy_name)
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
