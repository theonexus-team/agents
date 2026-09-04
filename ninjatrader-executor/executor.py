"""Processes one ExecutionIntent at a time: places the real order in NinjaTrader via
ATI, waits for a confirmed fill, then reports the real fill price back to the
dashboard. See README.md's "Known risks" section before running this unattended
against a funded account."""

from __future__ import annotations

import logging

import ati
import client
import config
import state

log = logging.getLogger("ninjatrader-executor.executor")

# In-memory only (resets on restart) — stops hammering NinjaTrader with repeated
# retries of an intent that keeps failing (e.g. a bad instrument name), while still
# letting a genuinely transient rejection retry a couple of times. A human needs to
# look at anything that hits this — see the CRITICAL log line below.
MAX_ATTEMPTS = 3
_attempt_counts: dict[str, int] = {}

DIRECTION_TO_ACTION = {"LONG": "BUY", "SHORT": "SELL"}
OPPOSITE_ACTION = {"LONG": "SELL", "SHORT": "BUY"}


def _nt_instrument(symbol: str) -> str:
    instrument = config.INSTRUMENT_MAP.get(symbol)
    if not instrument:
        raise ValueError(f"no NinjaTrader instrument configured for {symbol} — set INSTRUMENT_{symbol} in .env")
    return instrument


def process_intent(intent: dict) -> None:
    intent_id = intent["id"]
    attempts = _attempt_counts.get(intent_id, 0)
    if attempts >= MAX_ATTEMPTS:
        log.critical(
            "intent %s (%s %s) has failed %d times — giving up on it automatically. "
            "It is still 'claimed' server-side and will NOT be retried again by this "
            "process. A human needs to check NinjaTrader's actual position/orders and "
            "the ExecutionIntent row directly.",
            intent_id, intent["action"], intent["symbol"], attempts,
        )
        return

    try:
        if intent["action"] == "entry":
            _process_entry(intent)
        elif intent["action"] == "exit":
            _process_exit(intent)
        else:
            log.error("unknown intent action %r for %s, skipping", intent["action"], intent_id)
    except Exception:
        _attempt_counts[intent_id] = attempts + 1
        log.exception(
            "failed processing intent %s (attempt %d/%d) — it stays claimed and will be "
            "retried on a later poll (server reclaims stale claims after 2 minutes)",
            intent_id, attempts + 1, MAX_ATTEMPTS,
        )


def _process_entry(intent: dict) -> None:
    intent_id = intent["id"]
    symbol = intent["symbol"]
    direction = intent["direction"]
    contracts = intent["contracts"] or 1
    instrument = _nt_instrument(symbol)
    action = DIRECTION_TO_ACTION[direction]

    log.info("ENTRY intent %s: %s %s x%d (%s)", intent_id, action, symbol, contracts, instrument)
    ati.place_market_order(instrument, action, contracts, order_id=intent_id)
    fill = ati.wait_for_fill(intent_id, qty=contracts)

    if fill.state in ati.TERMINAL_FAILURE_STATES:
        raise RuntimeError(f"order {intent_id} ended in {fill.state}, not filled")

    state.set_open(symbol, direction, fill.filled_qty or contracts)
    result = client.report_fill(intent_id, fill.avg_fill_price)
    log.info("reported entry fill for %s: %s", intent_id, result)


def _process_exit(intent: dict) -> None:
    intent_id = intent["id"]
    symbol = intent["symbol"]
    open_position = state.get_open(symbol)

    if open_position is None:
        # Our local record of what's open disagrees with the server's — this can
        # happen if the watcher was restarted and lost its state.json, or if a
        # position was closed manually in NinjaTrader without going through this
        # pipeline. Don't guess a direction/quantity to flatten; a human needs to
        # reconcile NinjaTrader's actual position against the dashboard directly.
        log.critical(
            "EXIT intent %s for %s has no known open position in local state — "
            "refusing to guess a flatten direction/quantity. Check NinjaTrader's "
            "actual position for %s and reconcile manually.",
            intent_id, symbol, symbol,
        )
        raise RuntimeError(f"no local state for open {symbol} position")

    instrument = _nt_instrument(symbol)
    action = OPPOSITE_ACTION[open_position["direction"]]
    contracts = open_position["contracts"]

    log.info("EXIT intent %s: %s %s x%d (%s)", intent_id, action, symbol, contracts, instrument)
    ati.place_market_order(instrument, action, contracts, order_id=intent_id)
    fill = ati.wait_for_fill(intent_id, qty=contracts)

    if fill.state in ati.TERMINAL_FAILURE_STATES:
        raise RuntimeError(f"flatten order {intent_id} ended in {fill.state}, not filled")

    result = client.report_fill(intent_id, fill.avg_fill_price, outcome=intent.get("outcomeHint"))
    state.clear_open(symbol)
    log.info("reported exit fill for %s: %s", intent_id, result)
