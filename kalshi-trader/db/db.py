from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import psycopg

import config  # noqa: F401  (side effect: loads .env files before we read os.environ below)
from execution.position import KalshiPosition, PositionStatus
from signals.types import Signal


def get_conn() -> psycopg.Connection:
    """Mirrors backtest/engine/db.py: prefers BACKTEST_DATABASE_URL (the production Neon DB
    the Vercel dashboard reads from) over DATABASE_URL."""
    url = os.environ.get("BACKTEST_DATABASE_URL") or os.environ["DATABASE_URL"]
    return psycopg.connect(url)


def write_open_trade(pos: KalshiPosition, signal: Signal, is_paper: bool) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "KalshiTrade"
                (id, ticker, side, "strikePrice", "windowCloseAt", "entryPrice", contracts,
                 "stopPrice", "targetPrice", status, "openedAt", "btcSpotAtEntry", strategy, "isPaper")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'open', %s, %s, %s, %s)
            """,
            (
                pos.id, pos.ticker, "YES" if pos.entry_side == "bid" else "NO",
                pos.strike_price, pos.window_close_at, pos.entry_price, pos.contracts,
                pos.stop_price, pos.target_price, pos.opened_at,
                pos.btc_spot_at_entry, pos.strategy, is_paper,
            ),
        )
        conn.commit()


def write_trade_close(pos: KalshiPosition) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "KalshiTrade"
            SET "exitPrice" = %s, status = 'closed', outcome = %s, net = %s,
                "feesPaid" = %s, "closedAt" = %s
            WHERE id = %s
            """,
            (
                pos.exit_price, pos.status.value, pos.net_pnl(), pos.fees_paid, pos.closed_at, pos.id,
            ),
        )
        conn.commit()


def write_signal(signal: Signal, fired: bool, blocked_reason: Optional[str] = None) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "KalshiSignal"
                (id, direction, "windowStart", "windowCloseAt", "vwapValue", "orHigh", "orLow",
                 fired, "blockedReason", "occurredAt", "isPaper", strategy)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()), signal.direction.value, signal.window_start, signal.window_close_at,
                signal.vwap_value, signal.or_high, signal.or_low, fired, blocked_reason, signal.occurred_at,
                config.PAPER_MODE, signal.strategy,
            ),
        )
        conn.commit()


def recover_open_position(is_paper: bool) -> Optional[KalshiPosition]:
    """Called once at startup: the bot holds its one open position only in memory
    (ExecutionManager._position), so any restart - a crash, a code deploy, killing
    the process to pick up a fix - orphans whatever trade was open, with nothing
    left to manage its exit. Confirmed as a real incident 2026-08-23: a restart
    mid-trade left an 829-contract position sitting open in the DB forever with no
    process watching it. Re-adopts the one open row matching the current paper/real
    mode (there should never be more than one, single-position-at-a-time by design)
    so monitor_loop can resume managing it immediately after a restart."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, ticker, strategy, "strikePrice", side, "entryPrice", contracts,
                   "stopPrice", "targetPrice", "windowCloseAt", "openedAt", "btcSpotAtEntry"
            FROM "KalshiTrade" WHERE status = 'open' AND "isPaper" = %s
            ORDER BY "openedAt" DESC LIMIT 1
            """,
            (is_paper,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        (id_, ticker, strategy, strike_price, side, entry_price, contracts,
         stop_price, target_price, window_close_at, opened_at, btc_spot_at_entry) = row
        return KalshiPosition(
            id=id_,
            ticker=ticker,
            strategy=strategy,
            strike_price=float(strike_price),
            entry_side="bid" if side == "YES" else "ask",
            entry_price=float(entry_price),
            contracts=contracts,
            stop_price=float(stop_price),
            target_price=float(target_price),
            window_close_at=window_close_at.replace(tzinfo=timezone.utc),
            opened_at=opened_at.replace(tzinfo=timezone.utc),
            status=PositionStatus.OPEN,
            btc_spot_at_entry=float(btc_spot_at_entry) if btc_spot_at_entry is not None else None,
        )


def read_engine_state() -> dict:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT paused, "killSwitch", "stakePerTrade", "maxDailyLoss", "maxTradesPerDay", "startingBalance", "maxDailyProfit"
            FROM "KalshiEngineState" WHERE id = 'singleton'
            """
        )
        row = cur.fetchone()
        if row is None:
            return {"paused": False, "killSwitch": False, "stakePerTrade": 12.5, "maxDailyLoss": 50, "maxTradesPerDay": 5, "startingBalance": 10.0, "maxDailyProfit": 100.0}
        return {
            "paused": row[0], "killSwitch": row[1], "stakePerTrade": float(row[2]),
            "maxDailyLoss": float(row[3]), "maxTradesPerDay": row[4], "startingBalance": float(row[5]),
            "maxDailyProfit": float(row[6]),
        }


def cumulative_net_pnl(is_paper: bool) -> float:
    """Sum of net PnL on every closed trade matching the given paper/real mode -
    paper and real books are tracked as separate equity curves, so a bot flipped
    from paper to real starts compounding fresh from startingBalance rather than
    inheriting paper-mode gains/losses."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            'SELECT COALESCE(SUM(net), 0) FROM "KalshiTrade" WHERE status = %s AND "isPaper" = %s',
            ("closed", is_paper),
        )
        return float(cur.fetchone()[0])


def heartbeat(live_balance_usd: Optional[float] = None) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            'UPDATE "KalshiEngineState" SET "botLastSeen" = %s, "paperMode" = %s, "lastKnownBalance" = %s WHERE id = \'singleton\'',
            (datetime.now(timezone.utc), config.PAPER_MODE, live_balance_usd),
        )
        conn.commit()


def set_kill_switch(reason: str) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            'UPDATE "KalshiEngineState" SET "killSwitch" = true, "killSwitchReason" = %s WHERE id = \'singleton\'',
            (reason,),
        )
        conn.commit()


def today_trade_count() -> int:
    """Real trades only - paper trades don't consume the real daily trade budget."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT COUNT(*) FROM "KalshiTrade"
               WHERE "closedAt" >= date_trunc('day', now() AT TIME ZONE 'UTC') AND "isPaper" = false"""
        )
        return cur.fetchone()[0]


def today_realized_loss() -> float:
    """Returns a non-positive number: sum of net PnL on today's closed REAL trades,
    capped at 0. Paper trades don't count toward the real daily loss limit."""
    return min(_today_realized_pnl(), 0.0)


def today_realized_profit() -> float:
    """Returns a non-negative number: sum of net PnL on today's closed REAL trades,
    floored at 0. Paper trades don't count toward the real daily profit target."""
    return max(_today_realized_pnl(), 0.0)


def _today_realized_pnl() -> float:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT COALESCE(SUM(net), 0) FROM "KalshiTrade"
               WHERE "closedAt" >= date_trunc('day', now() AT TIME ZONE 'UTC') AND "isPaper" = false"""
        )
        return float(cur.fetchone()[0])
