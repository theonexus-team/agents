"""Turtle Soup — one of 8 ICT concepts from a retail explainer video the user
provided (not a Pine port, no existing indicator to port from). Rules as described:
trade WITH the prevailing trend, entering when price raids liquidity beyond a
recent swing (a stop-hunt against the trend) while resting above/below a fair
value gap in the trend direction, then reverses back in the trend's favor.

Trend definition (not specified precisely in the source video — my choice,
documented here): current market-structure bias from engine.ict.SwingTracker's
most recent confirmed structure shift. "Uptrend" = the last shift was bullish
(closed above the prior swing high), "downtrend" = last shift was bearish. No
trend established yet -> no trades.

Bullish setup: in an uptrend, price wicks below the last confirmed swing low and
closes back above it (a liquidity raid + rejection, engine.ict.swept_below) while
an unfilled bullish FVG sits below current price. Entry at that bar's close, stop
at the raid bar's low, target the next confirmed swing high (the obvious
opposite-side liquidity) — skip the trade if none exists yet, same "don't invent a
target" philosophy as algo2_first_touch's zone-to-zone targeting.
Bearish setup mirrors it in a downtrend.
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.ict import FvgTracker, SwingTracker, swept_above, swept_below
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"
_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class TurtleSoupStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.TOKYO: SessionWindow("Tokyo", 7, 0, 16, 0, _GMT7),
        SessionKey.SHANGHAI: SessionWindow("Shanghai", 8, 0, 15, 0, _GMT7),
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        self.contracts = params.get("contracts", 1 if instrument.symbol == "HG" else 4)
        self.swings = SwingTracker(lookback=params.get("swing_lookback", 3))
        self.fvg = FvgTracker()
        self.trend: Optional[str] = None  # "up" | "down" | None
        self.trades_this_session = 0

    def _entry_contracts(self, ctx: EngineContext) -> int:
        """HG stays fixed (project convention, matches src/lib/positionSizing.ts:
        "HG is never scaled... it's a full-size contract, not a micro"), and so does
        anything explicitly marked sizing_mode="fixed" (e.g. an "eval phase" leg
        that wants a bigger static size instead of the ladder). Otherwise MGC/MNQ use
        the shared portfolio's dynamic ladder when one is attached (engine.portfolio.
        PortfolioRunner), else fall back to this strategy's own fixed count."""
        if self.instrument.symbol == "HG" or self.params.get("sizing_mode") == "fixed":
            return self.contracts
        return ctx.scaled_contracts() or self.contracts

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        self.trades_this_session = 0

    def _session_label(self, bar: Bar) -> SessionKey:
        for key in _PRIORITY:
            if bar_in_session(self.SESSION_WINDOWS[key], bar.ts):
                return key
        return SessionKey.NEW_YORK

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.swings.update(bar)
        self.fvg.update(bar)

        shift = self.swings.structure_shift(bar)
        if shift == "bullish":
            self.trend = "up"
        elif shift == "bearish":
            self.trend = "down"

        max_per_session = self.params.get("max_trades_per_session", 3)
        if ctx.has_open("Long") or ctx.has_open("Short") or self.trades_this_session >= max_per_session:
            return

        if self.trend == "up" and self.swings.last_swing_low is not None:
            if swept_below(bar, self.swings.last_swing_low.price) and self.fvg.unfilled_bullish():
                target = self.swings.last_swing_high
                if target is not None and target.price > bar.close:
                    ctx.enter(Direction.LONG, bar.low, target.price, self._entry_contracts(ctx), self._session_label(bar), tag="Long")
                    self.trades_this_session += 1

        elif self.trend == "down" and self.swings.last_swing_high is not None:
            if swept_above(bar, self.swings.last_swing_high.price) and self.fvg.unfilled_bearish():
                target = self.swings.last_swing_low
                if target is not None and target.price < bar.close:
                    ctx.enter(Direction.SHORT, bar.high, target.price, self._entry_contracts(ctx), self._session_label(bar), tag="Short")
                    self.trades_this_session += 1
