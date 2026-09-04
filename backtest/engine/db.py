from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import psycopg
from dotenv import load_dotenv

from .bar import InstrumentSpec
from .pnl import compute_close_pnl
from .runner import ClosedTrade

_ENV_LOADED = False


def _ensure_env_loaded() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")
    _ENV_LOADED = True


def get_conn() -> psycopg.Connection:
    """Prefers BACKTEST_DATABASE_URL (production Neon, same DB the live Vercel
    dashboard reads from) over DATABASE_URL (local dev Postgres), so backtest results
    show up on the real dashboard by default."""
    _ensure_env_loaded()
    url = os.environ.get("BACKTEST_DATABASE_URL") or os.environ["DATABASE_URL"]
    return psycopg.connect(url)


def write_trades(
    conn: psycopg.Connection,
    run_id: str,
    strategy: str,
    instrument: InstrumentSpec,
    trades: list[ClosedTrade],
    risk_per_trade: float = 150.0,
) -> None:
    """Inserts BacktestTrade rows for an EXISTING run id. Shared by write_run() (new
    run, CLI path) and worker.py (existing queued run, dashboard "Run" button path)
    so both go through the identical net/worst/best-point computation."""
    with conn.cursor() as cur:
        for t in trades:
            pnl = compute_close_pnl(
                direction=t.direction.value,
                entry_price=t.entry_price,
                stop_price=t.initial_stop_price,
                exit_price=t.exit_price,
                contracts=t.contracts,
                tick_value=instrument.tick_value,
                tick_size=instrument.tick_size,
                risk_per_trade=risk_per_trade,
            )
            # Matches the live webhook's own fallback exactly (src/app/api/webhook/
            # tradingview/route.ts) — see ClosedTrade's docstring in runner.py.
            worst_point = min(0.0, pnl.net)
            best_point = max(0.0, pnl.net)
            cur.execute(
                """
                INSERT INTO "BacktestTrade"
                  (id, "runId", "instrumentSymbol", direction, session, strategy,
                   "entryPrice", "exitPrice", "openedAt", "closedAt", outcome,
                   "worstPoint", "bestPoint", net, "perDollarRisked", contracts,
                   "includedInRuleset")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                """,
                (
                    uuid.uuid4().hex,
                    run_id,
                    instrument.symbol,
                    t.direction.value,
                    t.session.value,
                    strategy,
                    t.entry_price,
                    t.exit_price,
                    t.opened_at,
                    t.closed_at,
                    t.outcome.value,
                    worst_point,
                    best_point,
                    pnl.net,
                    pnl.per_dollar_risked,
                    t.contracts,
                ),
            )
    conn.commit()


def write_run(
    conn: psycopg.Connection,
    strategy: str,
    instrument: InstrumentSpec,
    timeframe: str,
    mode: str,  # "HISTORICAL" | "FORWARD"
    trades: list[ClosedTrade],
    parameters: dict,
    source_note: Optional[str],
    starting_balance: float,
    data_start: datetime,
    data_end: datetime,
    risk_per_trade: float = 150.0,
) -> str:
    """Creates a new BacktestRun (status='completed') + all its BacktestTrade rows.

    data_start/data_end must be the REQUESTED backtest range (what you passed to
    --from/--to), not derived from the trades themselves — a sparse strategy with
    trades clustered in a fraction of the window would otherwise store a misleadingly
    short span, badly skewing anything computed from it (e.g. trades/day)."""
    run_id = uuid.uuid4().hex

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "BacktestRun"
              (id, strategy, "instrumentSymbol", timeframe, mode, "dataStart", "dataEnd",
               parameters, "sourceNote", "startingBalance", status, "completedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, 'completed', now())
            """,
            (
                run_id,
                strategy,
                instrument.symbol,
                timeframe,
                mode,
                data_start,
                data_end,
                json.dumps(parameters),
                source_note,
                starting_balance,
            ),
        )
    conn.commit()

    write_trades(conn, run_id, strategy, instrument, trades, risk_per_trade)
    return run_id


def update_run_parameters(conn: psycopg.Connection, run_id: str, parameters: dict) -> None:
    """Overwrites a run's stored parameters — used when a queued run arrived with no
    parameters (the dashboard form doesn't expose per-parameter overrides) and the
    worker resolved a strategy's default JSON file to actually run it with. Without
    this, the run's stored `parameters` would just be `{}`, defeating the whole
    point of that field (reproducibility of what was ACTUALLY used)."""
    with conn.cursor() as cur:
        cur.execute("""UPDATE "BacktestRun" SET parameters = %s::jsonb WHERE id = %s""", (json.dumps(parameters), run_id))
    conn.commit()


def write_portfolio_run(
    conn: psycopg.Connection,
    label: str,
    starting_balance: float,
    max_loss_from_peak: float,
    sizing_mode: str,  # "fixed" | "dynamic"
    legs: list[tuple[str, InstrumentSpec, list[ClosedTrade], dict]],  # (strategy, instrument, trades, parameters)
    timeframe: str,
    mode: str,  # "HISTORICAL" | "FORWARD"
    data_start: datetime,
    data_end: datetime,
    source_note: Optional[str] = None,
    risk_per_trade: float = 150.0,
) -> str:
    """Creates a PortfolioRun + one BacktestRun (tagged with portfolioRunId) per leg,
    via write_run — so a portfolio's legs show up on the ordinary /backtests list
    too, individually, in addition to their combined view."""
    portfolio_id = uuid.uuid4().hex
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "PortfolioRun"
              (id, label, "startingBalance", "maxLossFromPeak", "sizingMode", "sourceNote", status, "completedAt")
            VALUES (%s, %s, %s, %s, %s, %s, 'completed', now())
            """,
            (portfolio_id, label, starting_balance, max_loss_from_peak, sizing_mode, source_note),
        )
    conn.commit()

    for strategy, instrument, trades, parameters in legs:
        run_id = write_run(
            conn, strategy, instrument, timeframe, mode, trades, parameters, None, starting_balance, data_start, data_end, risk_per_trade
        )
        with conn.cursor() as cur:
            cur.execute("""UPDATE "BacktestRun" SET "portfolioRunId" = %s WHERE id = %s""", (portfolio_id, run_id))
        conn.commit()

    return portfolio_id


def mark_run_status(conn: psycopg.Connection, run_id: str, status: str, source_note: Optional[str] = None) -> None:
    """Flips a queued/running run to 'completed' or 'failed'. source_note, if given,
    REPLACES the existing note (used to record a failure reason — BacktestRun has no
    dedicated error-message column, and adding one for this alone isn't worth a
    migration yet)."""
    with conn.cursor() as cur:
        if source_note is not None:
            cur.execute(
                """UPDATE "BacktestRun" SET status = %s, "sourceNote" = %s, "completedAt" = now() WHERE id = %s""",
                (status, source_note, run_id),
            )
        else:
            cur.execute(
                """UPDATE "BacktestRun" SET status = %s, "completedAt" = now() WHERE id = %s""",
                (status, run_id),
            )
    conn.commit()
