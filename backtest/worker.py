"""Polls for BacktestRun rows with status='queued' (created by the dashboard's
"Run new backtest" form, POST /api/backtests/run) and executes them, one pass —
run this manually (`python worker.py`) or on a schedule.

This exists because the backtest engine only runs locally (this machine's Python
venv) while the dashboard is a Vercel serverless deployment that cannot invoke a
local process on demand — there's no way for a browser button click hitting Vercel
to run code on your machine directly. A queued-row-in-Postgres + local poller is the
standard way to bridge that gap: the web UI can queue a request from anywhere, and
whichever machine happens to be running this script (or the scheduled task that
calls it — see backtest/README.md) picks it up and executes it for real.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

from engine.bars_store import coverage, read_bars
from engine.db import get_conn, mark_run_status, update_run_parameters, write_trades
from engine.runner import BacktestRunner
from strategies import STRATEGIES
from cli import INSTRUMENTS

PARAMS_DIR = Path(__file__).resolve().parent / "strategies" / "params"


def _resolve_params(strategy_name: str, requested: dict | None) -> dict:
    """The dashboard's "Run new backtest" form doesn't expose per-parameter
    overrides, so a dashboard-queued run always arrives with parameters={}. Falling
    back silently to each Strategy subclass's own .get(key, hardcoded_default) calls
    would run it correctly, but the run's stored `parameters` — kept specifically for
    reproducibility — would then just say `{}`, which is misleading. Load that
    strategy's committed default params file instead, so what's stored matches what
    actually ran, same as a CLI run with --params pointed at that same file."""
    if requested:
        return requested
    default_file = PARAMS_DIR / f"{strategy_name}_default.json"
    if default_file.exists():
        return json.loads(default_file.read_text())
    return {}


def process_queued_runs() -> int:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT id, strategy, "instrumentSymbol", timeframe, "dataStart", "dataEnd", parameters
                           FROM "BacktestRun" WHERE status = 'queued' ORDER BY "createdAt" ASC""")
            queued = cur.fetchall()

        if not queued:
            print("No queued runs.")
            return 0

        processed = 0
        for run_id, strategy_name, symbol, timeframe, data_start, data_end, params in queued:
            print(f"Processing {run_id}: {strategy_name} {symbol} {timeframe} [{data_start} -> {data_end}]")
            try:
                if strategy_name not in STRATEGIES:
                    raise ValueError(f"Unknown strategy '{strategy_name}'")
                if symbol not in INSTRUMENTS:
                    raise ValueError(f"Unknown symbol '{symbol}'")

                instrument = INSTRUMENTS[symbol]
                cov = coverage(symbol, timeframe)
                if cov is None:
                    raise ValueError(
                        f"No bars ingested for {symbol}/{timeframe} — run `python cli.py ingest` or "
                        f"`python cli.py fetch-yahoo` first."
                    )

                bars = read_bars(symbol, timeframe, data_start, data_end)
                if not bars:
                    raise ValueError(
                        f"No bars in [{data_start}, {data_end}] for {symbol}/{timeframe}. "
                        f"Ingested coverage is {cov[0]} -> {cov[1]}."
                    )

                resolved_params = _resolve_params(strategy_name, params)
                strategy = STRATEGIES[strategy_name](resolved_params, instrument)
                runner = BacktestRunner(strategy, instrument)
                trades = runner.run(bars)

                write_trades(conn, run_id, strategy_name, instrument, trades)
                if resolved_params != params:
                    update_run_parameters(conn, run_id, resolved_params)
                mark_run_status(conn, run_id, "completed")
                print(f"  -> completed, {len(trades)} trade(s)")
                processed += 1
            except Exception as e:  # noqa: BLE001 -- one bad queued run shouldn't stop the others
                mark_run_status(conn, run_id, "failed", source_note=f"FAILED: {e}")
                print(f"  -> failed: {e}", file=sys.stderr)
                traceback.print_exc()

        return processed
    finally:
        conn.close()


if __name__ == "__main__":
    process_queued_runs()
