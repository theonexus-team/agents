"""Shared primitives for ICT ("Inner Circle Trader" / smart-money-concepts)
strategies: fair value gaps, swing highs/lows, and market structure shifts.

These are NOT ports of any specific Pine/TradingView indicator or paper — there is
no single canonical formula for "fair value gap" or "market structure shift" the
way there was a specific UAlgo order-block algorithm to port for the first two
strategies. This is an original implementation of the standard retail-education
definitions (the same ones a typical ICT explainer describes), written down
explicitly here so the choice is visible and correctable, not a claim of
canonical accuracy. If your own read of these concepts differs, this is the one
file to adjust — every strategy using it inherits the change.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .bar import Bar


@dataclass
class FairValueGap:
    direction: str  # "bullish" | "bearish"
    top: float
    bottom: float
    bar_index: int  # index of the 3rd (confirming) candle
    formed_at: datetime
    filled: bool = False
    #: True once price closed all the way through the zone (past `filled`) —
    #: the trigger condition for the Inversion FVG strategy. Same bar as `filled`
    #: transitions True; kept separate so a caller can ask "which gaps just failed
    #: THIS bar" via invalidated_at_index below.
    inverted: bool = False
    invalidated_at_index: Optional[int] = None


class FvgTracker:
    """3-candle fair value gap: bullish when candle[0].high < candle[2].low (price
    left a gap below it on the way up — support on a pullback), bearish when
    candle[0].low > candle[2].high (gap above — resistance on a pullback). A gap
    is "filled"/"inverted" the first bar price CLOSES all the way through the zone
    (a wick through doesn't count — matches the close-through-invalidation
    convention already used for order blocks elsewhere in this project)."""

    def __init__(self, max_active: int = 30):
        self.bars: list[Bar] = []
        self.max_active = max_active
        self.active: list[FairValueGap] = []

    def update(self, bar: Bar) -> Optional[FairValueGap]:
        """Call once per bar, in order. Returns a newly formed FVG this bar, if any."""
        self.bars.append(bar)
        n = len(self.bars) - 1
        new_fvg = None

        if n >= 2:
            c0, c2 = self.bars[n - 2], self.bars[n]
            if c0.high < c2.low:
                new_fvg = FairValueGap("bullish", top=c2.low, bottom=c0.high, bar_index=n, formed_at=bar.ts)
            elif c0.low > c2.high:
                new_fvg = FairValueGap("bearish", top=c0.low, bottom=c2.high, bar_index=n, formed_at=bar.ts)
            if new_fvg is not None:
                self.active.append(new_fvg)
                if len(self.active) > self.max_active:
                    self.active.pop(0)

        for gap in self.active:
            if gap.filled:
                continue
            if gap.direction == "bullish" and bar.close < gap.bottom:
                gap.filled = True
                gap.inverted = True
                gap.invalidated_at_index = n
            elif gap.direction == "bearish" and bar.close > gap.top:
                gap.filled = True
                gap.inverted = True
                gap.invalidated_at_index = n

        return new_fvg

    def unfilled_bullish(self) -> list[FairValueGap]:
        return [g for g in self.active if g.direction == "bullish" and not g.filled]

    def unfilled_bearish(self) -> list[FairValueGap]:
        return [g for g in self.active if g.direction == "bearish" and not g.filled]

    def just_inverted(self, bar_index: int) -> list[FairValueGap]:
        """Gaps that flipped filled->inverted exactly on this bar index."""
        return [g for g in self.active if g.invalidated_at_index == bar_index]


@dataclass
class SwingPoint:
    price: float
    bar_index: int
    ts: datetime


class SwingTracker:
    """N-bar-lookback/lookforward fractal swing high/low detector: a swing high at
    bar i is confirmed once i is the highest high among the `lookback` bars on
    either side of it — necessarily confirmed `lookback` bars LATE, the same
    real-world lag any swing-point detection has (you can't know a high held until
    later bars didn't exceed it)."""

    def __init__(self, lookback: int = 3):
        self.lookback = lookback
        self.bars: list[Bar] = []
        self.last_swing_high: Optional[SwingPoint] = None
        self.last_swing_low: Optional[SwingPoint] = None
        self._high_broken = False
        self._low_broken = False

    def update(self, bar: Bar) -> tuple[Optional[SwingPoint], Optional[SwingPoint]]:
        self.bars.append(bar)
        n = len(self.bars) - 1
        new_high = None
        new_low = None
        lb = self.lookback

        if n >= 2 * lb:
            center_idx = n - lb
            window = self.bars[center_idx - lb : n + 1]
            center_bar = self.bars[center_idx]
            if center_bar.high == max(b.high for b in window):
                new_high = SwingPoint(center_bar.high, center_idx, center_bar.ts)
                self.last_swing_high = new_high
                self._high_broken = False
            if center_bar.low == min(b.low for b in window):
                new_low = SwingPoint(center_bar.low, center_idx, center_bar.ts)
                self.last_swing_low = new_low
                self._low_broken = False

        return new_high, new_low

    def structure_shift(self, bar: Bar) -> Optional[str]:
        """Call once per bar, AFTER update(). Fires exactly once per swing
        reference — "bullish" on the first bar that CLOSES above the last
        confirmed swing high (demand breaking structure upward, i.e. a bearish->
        bullish market structure shift), "bearish" on the first close below the
        last confirmed swing low. On the rare bar where both fire at once,
        "bullish" wins arbitrarily — not a meaningful case in practice."""
        shift = None
        if self.last_swing_high is not None and not self._high_broken and bar.close > self.last_swing_high.price:
            self._high_broken = True
            shift = "bullish"
        if self.last_swing_low is not None and not self._low_broken and bar.close < self.last_swing_low.price:
            self._low_broken = True
            if shift is None:
                shift = "bearish"
        return shift


def swept_above(bar: Bar, level: float) -> bool:
    """Wicked above a level but closed back below it — a liquidity sweep/stop raid
    to the upside that got rejected, not a confirmed breakout."""
    return bar.high > level and bar.close < level


def swept_below(bar: Bar, level: float) -> bool:
    return bar.low < level and bar.close > level
