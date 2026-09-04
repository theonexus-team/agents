"""Simplified port of "Price Action Toolkit Lite [UAlgo]" (© UAlgo), licensed CC
BY-NC-SA 4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/ — noncommercial use
only, and if you ever share/publish this file it must carry that same license+credit.

This is the exact swing-high/low order-block algorithm both theonexus-orb-breakout.pine
and theonexus-algo2-first-touch.pine use identically — ported once and shared rather
than duplicated, matching how the two live scripts already share it. Touch-detection
and targeting semantics (tick tolerance, first-touch consumption, min age, etc.)
differ per strategy and are NOT part of this module — see each strategy file."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .bar import Bar


@dataclass
class OrderBlock:
    value: float
    bar_start: datetime
    bar_end: datetime
    broken: bool = False
    trades_taken: int = 0
    #: Bar index (into OrderBlockTracker.bars) at creation time. Not part of the
    #: Pine source — added so age-based eligibility checks (e.g. Algo 2's
    #: minAgeBars) can compare bar counts directly instead of reconstructing Pine's
    #: `(time - barEnd) >= minAgeBars * minutesPerBar * 60000` millisecond
    #: arithmetic, which only existed in Pine to work around not having direct
    #: bar-index history. Same result, timeframe-agnostic.
    bar_end_idx: int = 0


class OrderBlockTracker:
    """Bullish ("Buy") blocks span [value, value+atr] and act as support; bearish
    ("Sell") blocks span [value-atr, value] and act as resistance. Call update(bar)
    once per bar, in chronological order."""

    def __init__(self, struct_len: int = 9, keep_count: int = 2, atr_period: int = 14):
        self.struct_len = struct_len
        self.keep_count = keep_count
        self.atr_period = atr_period

        self.bars: list[Bar] = []
        self._atr: float | None = None
        self._atr_seed: list[float] = []

        self.ob_trend = 1
        self.ob_draw_up = False
        self.ob_draw_down = False

        self.ob_high_val: list[float] = []
        self.ob_high_val_idx: list[int] = []
        self.ob_low_val: list[float] = []
        self.ob_low_val_idx: list[int] = []

        self.bullish: list[OrderBlock] = []
        self.bearish: list[OrderBlock] = []

    @property
    def atr(self) -> float:
        return self._atr or 0.0

    def _update_atr(self, bar: Bar) -> None:
        if not self.bars:
            tr = bar.high - bar.low
        else:
            prev_close = self.bars[-1].close
            tr = max(bar.high - bar.low, abs(bar.high - prev_close), abs(bar.low - prev_close))
        if self._atr is None:
            self._atr_seed.append(tr)
            if len(self._atr_seed) >= self.atr_period:
                self._atr = sum(self._atr_seed) / self.atr_period
        else:
            self._atr = (self._atr * (self.atr_period - 1) + tr) / self.atr_period

    def update(self, bar: Bar) -> None:
        self._update_atr(bar)
        self.bars.append(bar)
        n = len(self.bars) - 1

        prev_trend = self.ob_trend
        if n >= self.struct_len:
            window = self.bars[n - self.struct_len + 1 : n + 1]
            highest = max(b.high for b in window)
            lowest = min(b.low for b in window)
            ob_to_up = self.bars[n - self.struct_len].high >= highest
            ob_to_down = self.bars[n - self.struct_len].low <= lowest
            if self.ob_trend == 1 and ob_to_down:
                self.ob_trend = -1
            elif self.ob_trend == -1 and ob_to_up:
                self.ob_trend = 1

        if self.ob_trend != prev_trend and self.ob_trend == 1:
            self.ob_high_val_idx.append(n - self.struct_len)
            self.ob_high_val.append(self.bars[n - self.struct_len].high)
            if len(self.ob_low_val) > 1:
                self.ob_draw_up = False

        if self.ob_trend != prev_trend and self.ob_trend == -1:
            self.ob_low_val_idx.append(n - self.struct_len)
            self.ob_low_val.append(self.bars[n - self.struct_len].low)
            if len(self.ob_high_val) > 1:
                self.ob_draw_down = False

        if len(self.ob_low_val) > 1 and not self.ob_draw_down:
            if bar.close < self.ob_low_val[-1]:
                self.ob_draw_down = True
                window = self.bars[self.ob_low_val_idx[-1] : n + 1]
                peak = max(window, key=lambda b: b.high)
                self.bearish.append(OrderBlock(value=peak.high, bar_start=peak.ts, bar_end=bar.ts, bar_end_idx=n))
                if len(self.bearish) > 20:
                    self.bearish.pop(0)

        if len(self.ob_high_val) > 1 and not self.ob_draw_up:
            if bar.close > self.ob_high_val[-1]:
                self.ob_draw_up = True
                window = self.bars[self.ob_high_val_idx[-1] : n + 1]
                trough = min(window, key=lambda b: b.low)
                self.bullish.append(OrderBlock(value=trough.low, bar_start=trough.ts, bar_end=bar.ts, bar_end_idx=n))
                if len(self.bullish) > 20:
                    self.bullish.pop(0)

        # Invalidate/remove on close-through — only the `keep_count` NEWEST blocks
        # are ever checked (matches the Pine source's set_right-only branch for
        # anything older than that: those blocks sit inert, never invalidated this
        # way, until they age out of the 20-slot FIFO above).
        for i in range(len(self.bullish) - 1, max(-1, len(self.bullish) - 1 - self.keep_count), -1):
            if bar.close < self.bullish[i].value:
                del self.bullish[i]
        for i in range(len(self.bearish) - 1, max(-1, len(self.bearish) - 1 - self.keep_count), -1):
            if bar.close > self.bearish[i].value:
                del self.bearish[i]
