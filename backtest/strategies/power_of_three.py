"""Power of Three (AMD — Accumulation, Manipulation, Distribution) — one of 8 ICT
concepts from a retail explainer video the user provided (not a Pine port). Rules
as described: price consolidates into a range (accumulation), fakes out beyond the
range and returns inside (manipulation — a liquidity sweep of the range), then
makes its real move in the opposite direction (distribution); enter there using a
supply/demand zone.

Judgment calls:
- "Consolidation" = the high-low range over the last `range_lookback_bars` (default
  20) bars is no wider than `range_atr_multiple` (default 4) times the average
  single-bar range over that same window — a tight-range-relative-to-typical-
  volatility test, not a fixed tick threshold, so it scales across instruments
  without per-symbol tuning.
- "Manipulation" = engine.ict.swept_above/swept_below against that range's
  high/low (wick beyond it, close back inside).
- "Supply/demand zone" for the distribution-phase entry = any fair value gap
  unfilled at the moment of the sweep (same zone concept the other FVG-based
  strategies here use) — entering on first touch of one, opposite direction to
  the fakeout. No market-structure-shift confirmation and no session gate, unlike
  silver_bullet.py — the video doesn't describe either for this concept, which is
  also what keeps this mechanically distinct from Silver Bullet despite the shared
  "sweep then reverse" DNA.
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.ict import FairValueGap, FvgTracker, swept_above, swept_below
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"
_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class PowerOfThreeStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.TOKYO: SessionWindow("Tokyo", 7, 0, 16, 0, _GMT7),
        SessionKey.SHANGHAI: SessionWindow("Shanghai", 8, 0, 15, 0, _GMT7),
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        self.contracts = params.get("contracts", 1 if instrument.symbol == "HG" else 4)
        self.fvg = FvgTracker()
        self.bars: list[Bar] = []
        self.lookback = params.get("range_lookback_bars", 20)
        self.range_atr_multiple = params.get("range_atr_multiple", 4)

        self.phase: Optional[str] = None  # None | "armed_bear" | "armed_bull"
        self.armed_pool: list[FairValueGap] = []
        self.range_low_at_sweep: Optional[float] = None
        self.range_high_at_sweep: Optional[float] = None
        self.trades_this_session = 0

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        self.trades_this_session = 0

    def _session_label(self, bar: Bar) -> SessionKey:
        for key in _PRIORITY:
            if bar_in_session(self.SESSION_WINDOWS[key], bar.ts):
                return key
        return SessionKey.NEW_YORK

    def _consolidating(self) -> Optional[tuple[float, float]]:
        if len(self.bars) < self.lookback:
            return None
        window = self.bars[-self.lookback :]
        range_high = max(b.high for b in window)
        range_low = min(b.low for b in window)
        avg_bar_range = sum(b.high - b.low for b in window) / len(window)
        if avg_bar_range <= 0 or (range_high - range_low) > self.range_atr_multiple * avg_bar_range:
            return None
        return range_low, range_high

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.fvg.update(bar)
        prior_range = self._consolidating()  # from bars BEFORE this one
        self.bars.append(bar)

        max_per_session = self.params.get("max_trades_per_session", 3)
        session_capped = self.trades_this_session >= max_per_session

        if self.phase is None and prior_range is not None and not session_capped:
            range_low, range_high = prior_range
            if swept_above(bar, range_high):
                pool = list(self.fvg.unfilled_bearish())
                if pool:
                    self.phase, self.armed_pool, self.range_low_at_sweep = "armed_bear", pool, range_low
            elif swept_below(bar, range_low):
                pool = list(self.fvg.unfilled_bullish())
                if pool:
                    self.phase, self.armed_pool, self.range_high_at_sweep = "armed_bull", pool, range_high

        elif self.phase == "armed_bear" and not ctx.has_open("Short"):
            touched = next((g for g in self.armed_pool if not g.filled and bar.low <= g.top and bar.high >= g.bottom), None)
            if touched is not None:
                target = self.range_low_at_sweep
                stop = max(g.top for g in self.armed_pool)
                if target is not None and target < bar.close:
                    ctx.enter(Direction.SHORT, stop, target, self.contracts, self._session_label(bar), tag="Short")
                    self.trades_this_session += 1
                self.phase, self.armed_pool = None, []

        elif self.phase == "armed_bull" and not ctx.has_open("Long"):
            touched = next((g for g in self.armed_pool if not g.filled and bar.low <= g.top and bar.high >= g.bottom), None)
            if touched is not None:
                target = self.range_high_at_sweep
                stop = min(g.bottom for g in self.armed_pool)
                if target is not None and target > bar.close:
                    ctx.enter(Direction.LONG, stop, target, self.contracts, self._session_label(bar), tag="Long")
                    self.trades_this_session += 1
                self.phase, self.armed_pool = None, []
