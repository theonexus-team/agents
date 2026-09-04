from __future__ import annotations

import asyncio
import logging

import config
import db.db as db
from execution.manager import ExecutionManager
from kalshi_client import rest

logger = logging.getLogger("kalshi_trader.risk")


async def poll_loop(manager: ExecutionManager) -> None:
    """Runs independently of the signal-driven loop so a pause/kill-switch flip
    from the dashboard takes effect within RISK_POLL_SECONDS even if the bot is
    mid-way through waiting on the next signal."""
    while True:
        try:
            live_balance = None if config.PAPER_MODE else rest.get_balance() / 100
            db.heartbeat(live_balance)
            state = db.read_engine_state()
            if state["paused"] or state["killSwitch"]:
                await manager.force_flatten_if_open(reason="paused" if state["paused"] else "kill_switch")
        except Exception:
            logger.exception("risk poll loop iteration failed")
        await asyncio.sleep(config.RISK_POLL_SECONDS)
