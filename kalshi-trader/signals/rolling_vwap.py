from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from feed.bar_aggregator import Bar


@dataclass
class _Entry:
    pv: float
    volume: float


class RollingVwap:
    """Continuous VWAP over a trailing window of minutes - no daily reset, unlike the
    futures orb_vwap.py strategy (24/7 crypto market has no session/day boundary to
    anchor on). Sliding-window sum via deque, O(1) amortized per bar."""

    def __init__(self, window_minutes: int) -> None:
        self._window_minutes = window_minutes
        self._entries: deque[_Entry] = deque()
        self._sum_pv = 0.0
        self._sum_vol = 0.0

    def add_bar(self, bar: Bar) -> None:
        typical_price = (bar.high + bar.low + bar.close) / 3
        volume = max(bar.volume, 1e-9)  # tick feed has no reliable volume; floor avoids div-by-zero
        entry = _Entry(pv=typical_price * volume, volume=volume)
        self._entries.append(entry)
        self._sum_pv += entry.pv
        self._sum_vol += entry.volume
        while len(self._entries) > self._window_minutes:
            old = self._entries.popleft()
            self._sum_pv -= old.pv
            self._sum_vol -= old.volume

    @property
    def value(self) -> float | None:
        if self._sum_vol <= 0:
            return None
        return self._sum_pv / self._sum_vol
