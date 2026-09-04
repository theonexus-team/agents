from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from kalshi_client.rest import BookSide


class PositionStatus(str, Enum):
    OPEN = "open"
    TARGET_HIT = "TARGET_HIT"
    STOPPED_OUT = "STOPPED_OUT"
    FORCED_FLAT = "FORCED_FLAT"
    ERROR = "ERROR"


@dataclass
class KalshiPosition:
    id: str
    ticker: str
    strategy: str
    strike_price: float
    entry_side: BookSide  # 'bid' (long YES) or 'ask' (short YES / long NO)
    entry_price: float  # dollars, e.g. 0.42 - NOT integer cents, Kalshi uses tapered
    # sub-cent tick sizes near 0/1 (0.001 granularity below 0.10 and above 0.90).
    contracts: int
    stop_price: float
    target_price: float
    window_close_at: datetime
    opened_at: datetime
    status: PositionStatus = PositionStatus.OPEN
    exit_price: Optional[float] = None
    closed_at: Optional[datetime] = None
    fees_paid: Optional[float] = None
    btc_spot_at_entry: Optional[float] = None

    @property
    def exit_side(self) -> BookSide:
        return "ask" if self.entry_side == "bid" else "bid"

    def net_pnl(self) -> Optional[float]:
        if self.exit_price is None:
            return None
        direction = 1 if self.entry_side == "bid" else -1
        gross = direction * (self.exit_price - self.entry_price) * self.contracts
        return gross - (self.fees_paid or 0.0)
