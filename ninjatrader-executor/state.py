"""Tiny local JSON state file tracking which symbol currently has a real NinjaTrader
position open, and its direction/quantity — so an exit intent knows which direction
and size to place the opposite-side flatten order in. Deliberately local and simple
(this process is the only writer); the server's ExecutionIntent/OpenPosition rows are
the actual source of truth for the dashboard, this is just execution-side bookkeeping."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import config

log = logging.getLogger("ninjatrader-executor.state")


def _load() -> dict:
    if not config.STATE_FILE.exists():
        return {}
    try:
        return json.loads(config.STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        log.error("state file unreadable (%s), starting fresh: %s", config.STATE_FILE, e)
        return {}


def _save(data: dict) -> None:
    config.STATE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def set_open(symbol: str, direction: str, contracts: int) -> None:
    data = _load()
    data[symbol] = {"direction": direction, "contracts": contracts}
    _save(data)


def get_open(symbol: str) -> Optional[dict]:
    return _load().get(symbol)


def clear_open(symbol: str) -> None:
    data = _load()
    data.pop(symbol, None)
    _save(data)
