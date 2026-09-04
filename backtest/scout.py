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
import uuid
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
#: (MCL), metal (SIL).
CANDIDATES = ["MYM", "M2K", "MCL", "SIL"]
TIMEFRAMES = ["5m", "15m", "30m", "1h"]


def contracts_for(tick_value: float) -> int:
    """Same convention the LIVE strategy already applies to HG (1 contract, because
    its $12.50 tick value is high) vs MNQ/MGC (4 contracts, $0.50-$1.00 tick value)
    — generalized here by scaling inversely with tick value, anchored so MNQ's
    $0.50 tick value gets 4 contracts (matching the live default exactly).

    This matters because both strategies size their profit target as
    minProfitUsd / (tick_value * contracts) — without scaling contracts down for a
    high-tick-value instrument, that target becomes a trivially small price move.
    Confirmed this broke SIL's first scout run: at the original flat 4 contracts,
    SIL's target was an $0.04 move on a $30-45/oz instrument (silver's $5.00 tick
    value), producing a 94-97% "win rate" that was just noise clearing a target
    too small to mean anything, not a real edge. At the corrected 1 contract, the
    target becomes a real $0.16-0.20 move instead.
    """
    return max(1, round(4 * 0.50 / tick_value))


def params_for(symbol: str, strategy_name: str) -> dict:
    contracts = contracts_for(INSTRUMENTS[symbol].tick_value)
    if strategy_name == "orb_vwap":
        return {"contracts": contracts}
    # algo2_first_touch.py has no generic non-MNQ/MGC contracts key — anything not
    # MNQ or MGC falls through to hg_contracts (see algo2_first_touch.py:52), so
    # that's the one to override for every candidate here.
    return {"hg_contracts": contracts}


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

    params = params_for(symbol, strategy_name)
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


STRATEGY_NAMES = ["orb_vwap", "algo2_first_touch"]


def delete_existing_runs(symbols: list[str]) -> None:
    """Removes prior Instrument Scout BacktestRun rows (BacktestTrade cascades) for
    the given symbols before re-running — otherwise a re-run leaves stale rows
    alongside the new ones and /instrument-scout shows both the broken and fixed
    results at once."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM "BacktestRun" WHERE "sourceNote" = %s AND "instrumentSymbol" = ANY(%s)',
                (SOURCE_NOTE, symbols),
            )
            print(f"Deleted {cur.rowcount} stale run(s) for {symbols}.")
        conn.commit()
    finally:
        conn.close()


def post_to_board(message: str, url: str | None = None) -> None:
    """Writes to the same AgentMessage table the web app's Risk Watchdog and Trading
    Analyst post to (see src/lib/agentBoard.ts) — Prisma's @default(cuid()) is
    generated by Prisma's own client, not a Postgres-side default, so a raw insert
    from here has to supply an id itself. uuid4 hex is a fine id shape for this;
    nothing reads AgentMessage.id as if it were actually a cuid."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "AgentMessage" (id, agent, message, url) VALUES (%s, %s, %s, %s)',
                (uuid.uuid4().hex, "instrument-scout", message, url),
            )
        conn.commit()
    finally:
        conn.close()


def main(candidates: list[str] = CANDIDATES) -> None:
    print(f"Instrument Scout run started {datetime.now(timezone.utc).isoformat()}")
    delete_existing_runs(candidates)
    for symbol in candidates:
        if symbol not in INSTRUMENTS:
            print(f"Unknown symbol '{symbol}', skipping (add it to cli.py's INSTRUMENTS first)")
            continue
        for timeframe in TIMEFRAMES:
            print(f"{symbol} / {timeframe}")
            for strategy_name in STRATEGY_NAMES:
                run_one(symbol, timeframe, strategy_name)
    post_to_board(
        f"Backtested {', '.join(candidates)} across {', '.join(TIMEFRAMES)} with orb_vwap and algo2_first_touch. "
        f"See /instrument-scout for full results — this run doesn't auto-summarize a winner, that still needs a human "
        f"(or Claude Code) read given how sensitive these results are to target/contract-sizing calibration per instrument.",
        "/instrument-scout",
    )
    print("Done.")


if __name__ == "__main__":
    # Pass symbols on the command line to re-run just those (e.g. after a params
    # fix) instead of the full candidate list: `python scout.py MCL SIL`
    args = sys.argv[1:]
    sys.exit(main(args if args else CANDIDATES))
