from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass(frozen=True)
class Bar:
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class BarAggregator:
    """Rolls up (timestamp, price, size) ticks into closed 1-minute bars.
    Pure/network-free so it's unit-testable without a live feed."""

    def __init__(self) -> None:
        self._minute: Optional[datetime] = None
        self._open = self._high = self._low = self._close = 0.0
        self._volume = 0.0

    def add_tick(self, ts: datetime, price: float, size: float = 0.0) -> Optional[Bar]:
        minute = ts.replace(second=0, microsecond=0)
        closed_bar = None
        if self._minute is not None and minute != self._minute:
            closed_bar = Bar(self._minute, self._open, self._high, self._low, self._close, self._volume)
        if closed_bar is not None or self._minute is None:
            self._minute = minute
            self._open = self._high = self._low = self._close = price
            self._volume = size
        else:
            self._high = max(self._high, price)
            self._low = min(self._low, price)
            self._close = price
            self._volume += size
        return closed_bar
