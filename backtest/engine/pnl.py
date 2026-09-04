from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ClosePnlResult:
    net: float
    per_dollar_risked: float


def compute_close_pnl(
    direction: str,  # "LONG" | "SHORT"
    entry_price: float,
    stop_price: float,
    exit_price: float,
    contracts: Optional[int],
    tick_value: Optional[float],
    tick_size: Optional[float],
    risk_per_trade: float,
) -> ClosePnlResult:
    """Line-for-line port of src/lib/pnl.ts computeClosePnl — keep both in sync if the
    live formula ever changes."""
    stop_distance = abs(entry_price - stop_price) or 1.0
    price_move = (exit_price - entry_price) if direction == "LONG" else (entry_price - exit_price)

    if contracts and tick_value and tick_size:
        ticks_moved = price_move / tick_size
        net = round(ticks_moved * tick_value * contracts, 2)
        stop_ticks = stop_distance / tick_size
        dollar_risk = stop_ticks * tick_value * contracts
        per_dollar_risked = round(net / dollar_risk, 2) if dollar_risk > 0 else 0.0
        return ClosePnlResult(net=net, per_dollar_risked=per_dollar_risked)

    net = round((price_move / stop_distance) * risk_per_trade, 2)
    per_dollar_risked = round(net / risk_per_trade, 2)
    return ClosePnlResult(net=net, per_dollar_risked=per_dollar_risked)
