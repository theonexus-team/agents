"""Optimal Trade Entry (OTE) — one of 8 ICT concepts from a retail explainer video
the user provided (not a Pine port). Rules as described: Fibonacci-retracement
entry. For a bullish leg (swing low -> swing high), the OTE zone is the 0.618-0.786
retracement band measured back from the high; entry is a buy limit at the middle of
that zone. Stop below the swing low, target the swing high (the natural first draw
of liquidity). Mirror for a bearish leg.

Judgment calls:
- "Leg" = the most recently confirmed swing-low/swing-high pair from
  engine.ict.SwingTracker, using whichever one came LATER in time as the leg's
  direction (low-then-high = bullish leg, high-then-low = bearish leg). Each leg
  (identified by its later swing point's bar index) is only tradable once — the
  video doesn't say this explicitly, but without it the same leg would re-trigger
  every bar its range stays inside the zone.
- "Buy limit at the middle of the OTE zone" is simulated literally: a fill only
  happens on a bar whose [low, high] actually trades through the zone's exact
  midpoint price, filled AT that midpoint — not just "close was somewhere in the
  wider 0.618-0.786 band."
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.ict import SwingTracker
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"
_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class OptimalTradeEntryStrategy(Strategy):
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
        self.fib_shallow = params.get("fib_shallow", 0.618)
        self.fib_deep = params.get("fib_deep", 0.786)
        self._last_traded_leg_idx: Optional[int] = None
        self.trades_this_session = 0

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        self.trades_this_session = 0

    def _session_label(self, bar: Bar) -> SessionKey:
        for key in _PRIORITY:
            if bar_in_session(self.SESSION_WINDOWS[key], bar.ts):
                return key
        return SessionKey.NEW_YORK

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.swings.update(bar)

        max_per_session = self.params.get("max_trades_per_session", 3)
        if ctx.has_open("Long") or ctx.has_open("Short") or self.trades_this_session >= max_per_session:
            return

        low, high = self.swings.last_swing_low, self.swings.last_swing_high
        if low is None or high is None:
            return

        if high.bar_index > low.bar_index and self._last_traded_leg_idx != high.bar_index:
            # Bullish leg: low -> high, retracement measured back down from high.
            span = high.price - low.price
            zone_top = high.price - self.fib_shallow * span
            zone_bottom = high.price - self.fib_deep * span
            mid = (zone_top + zone_bottom) / 2
            if bar.low <= mid <= bar.high:
                ctx.enter(Direction.LONG, low.price, high.price, self.contracts, self._session_label(bar), tag="Long")
                self._last_traded_leg_idx = high.bar_index
                self.trades_this_session += 1

        elif low.bar_index > high.bar_index and self._last_traded_leg_idx != low.bar_index:
            # Bearish leg: high -> low, retracement measured back up from low.
            span = high.price - low.price
            zone_bottom = low.price + self.fib_shallow * span
            zone_top = low.price + self.fib_deep * span
            mid = (zone_top + zone_bottom) / 2
            if bar.low <= mid <= bar.high:
                ctx.enter(Direction.SHORT, high.price, low.price, self.contracts, self._session_label(bar), tag="Short")
                self._last_traded_leg_idx = low.bar_index
                self.trades_this_session += 1
