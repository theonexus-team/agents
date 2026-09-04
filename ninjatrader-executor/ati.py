"""NinjaTrader 8's Automated Trading Interface (ATI), file-based mode.

Reference: https://ninjatrader.com/support/helpGuides/nt8/order_instruction_files_oif.htm
and https://ninjatrader.com/support/helpguides/nt8/information_update_files.htm

Commands are dropped as text files into <NinjaTrader Documents>/incoming — NinjaTrader
watches that folder and processes each file the instant it's written. Fill/status
confirmations come back as text files in <NinjaTrader Documents>/outgoing, named after
the order ID WE supplied in the PLACE command (that's deliberate — it's how we find
our own order's confirmation instead of guessing).

Order state file format: "State;FilledAmount;AverageFillPrice"
Known terminal states: Filled, PartFilled, Rejected, Cancelled.
Non-terminal (still pending): Initialized, Submitted, Accepted, Working,
TriggerPending, ChangeSubmitted, CancelSubmitted.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import config

log = logging.getLogger("ninjatrader-executor.ati")

TERMINAL_FILLED_STATES = {"Filled", "PartFilled"}
TERMINAL_FAILURE_STATES = {"Rejected", "Cancelled"}


@dataclass
class FillResult:
    order_id: str
    state: str
    filled_qty: int
    avg_fill_price: float


def _write_oif_line(line: str) -> None:
    config.INCOMING_DIR.mkdir(parents=True, exist_ok=True)
    # Unique filename per NinjaTrader's own recommendation, to avoid file-locking
    # collisions if two commands land in the same instant.
    path = config.INCOMING_DIR / f"oif_{uuid.uuid4().hex}.txt"
    path.write_text(line + "\n", encoding="ascii")
    log.info("wrote OIF: %s -> %s", path.name, line)


def place_market_order(instrument: str, action: str, qty: int, order_id: str) -> None:
    """action must be 'BUY' or 'SELL'. order_id is ours to choose — it's what lets us
    find this specific order's fill confirmation in the outgoing folder afterward."""
    if action not in ("BUY", "SELL"):
        raise ValueError(f"action must be BUY or SELL, got {action!r}")
    line = f"PLACE;{config.NT_ACCOUNT};{instrument};{action};{qty};MARKET;;;DAY;;{order_id}"
    if config.DRY_RUN:
        log.info("[DRY RUN] would write OIF: %s", line)
        return
    _write_oif_line(line)


def wait_for_fill(order_id: str, qty: int, timeout_seconds: Optional[float] = None) -> FillResult:
    """Polls outgoing/{order_id}.txt until it reaches a terminal state, or times out.
    A timeout does NOT mean the order didn't fill — it means we couldn't confirm it in
    time. Callers must treat a timeout as "unknown, needs human eyes," never as
    "assume filled" or "assume failed" — see README's Known Risks section.

    qty is the quantity WE requested in the PLACE command — required even in the real
    (non-dry-run) path so callers have it for logging/sanity-checking against what
    the outgoing file actually reports, but only actually used as the fake fill
    quantity in DRY_RUN. In a previous version this was hardcoded to 1 in dry-run
    mode, which meant a 3-contract entry got "confirmed" as 1 and every exit after it
    only flattened 1 contract — caught by testing before this ever touched real
    orders, kept as a cautionary docstring note."""
    if config.DRY_RUN:
        log.info("[DRY RUN] pretending order %s filled at a fake price", order_id)
        return FillResult(order_id=order_id, state="Filled", filled_qty=qty, avg_fill_price=0.0)

    timeout = timeout_seconds if timeout_seconds is not None else config.FILL_TIMEOUT_SECONDS
    deadline = time.monotonic() + timeout
    path = config.OUTGOING_DIR / f"{order_id}.txt"
    last_seen: Optional[str] = None

    while time.monotonic() < deadline:
        if path.exists():
            try:
                content = path.read_text(encoding="ascii").strip()
            except OSError:
                # NinjaTrader may be mid-write; try again next poll.
                time.sleep(0.5)
                continue
            if content != last_seen:
                log.info("order %s status: %s", order_id, content)
                last_seen = content
            parts = content.split(";")
            state = parts[0] if parts else ""
            if state in TERMINAL_FILLED_STATES or state in TERMINAL_FAILURE_STATES:
                filled_qty = int(parts[1]) if len(parts) > 1 and parts[1] else 0
                avg_price = float(parts[2]) if len(parts) > 2 and parts[2] else 0.0
                return FillResult(order_id=order_id, state=state, filled_qty=filled_qty, avg_fill_price=avg_price)
        time.sleep(0.5)

    raise TimeoutError(f"order {order_id} did not reach a terminal state within {timeout}s (last seen: {last_seen!r})")


def flatten_everything_for_instrument(instrument: str) -> None:
    """CLOSEPOSITION doesn't accept a custom order ID, so we can't track ITS fill the
    same reliable way — this is a best-effort fallback only. Prefer placing an
    opposite-direction PLACE for the known open quantity instead (see executor.py),
    which we CAN track. Kept here for completeness / manual use."""
    line = f"CLOSEPOSITION;{config.NT_ACCOUNT};{instrument};;;;;;;;;;"
    if config.DRY_RUN:
        log.info("[DRY RUN] would write OIF: %s", line)
        return
    _write_oif_line(line)
