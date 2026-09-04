from __future__ import annotations

import logging
from typing import Optional

import db.db as db

logger = logging.getLogger("kalshi_trader.risk")


def can_open_new_trade() -> tuple[bool, Optional[str]]:
    """Restart-safe: counters are recomputed from KalshiTrade rows on every call,
    never held only in memory, so a crash/restart can't reset today's limits."""
    state = db.read_engine_state()
    if state["paused"]:
        return False, "paused"
    if state["killSwitch"]:
        return False, "kill_switch"
    if db.today_trade_count() >= state["maxTradesPerDay"]:
        return False, "max_trades_per_day"
    if db.today_realized_loss() <= -state["maxDailyLoss"]:
        return False, "max_daily_loss"
    if db.today_realized_profit() >= state["maxDailyProfit"]:
        return False, "max_daily_profit_reached"
    return True, None


def enforce_kill_switch_after_close() -> None:
    state = db.read_engine_state()
    realized_loss = db.today_realized_loss()
    if realized_loss <= -state["maxDailyLoss"]:
        logger.warning("Daily loss limit breached (%.2f <= -%.2f), tripping kill switch", realized_loss, state["maxDailyLoss"])
        db.set_kill_switch(f"daily loss {realized_loss:.2f} breached limit -{state['maxDailyLoss']:.2f}")
