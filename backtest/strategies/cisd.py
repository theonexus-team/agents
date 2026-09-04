"""Change in State of Delivery (CISD) — one of 8 ICT concepts from a retail
explainer video the user provided (not a Pine port). Rules as described: in an
established trend, a sudden opposite-direction fair value gap forming is a "change
in state of delivery" — a momentum shift signaling a possible reversal. Wait for
price to return into that FVG and show rejection, then trade the reversal.

Judgment calls:
- "Established trend" = engine.ict.SwingTracker's current structure bias (same
  definition turtle_soup.py uses) — no trend yet means no CISD signal is possible.
- The triggering event is specifically a FRESH FVG forming opposite the current
  trend (e.g. a bearish FVG appearing during an uptrend) — this is what
  distinguishes CISD from inversion_fvg.py, which instead trades an EXISTING FVG
  failing. Different trigger, related idea.
- "Show signs of rejection" on the pullback = the bar that touches the CISD zone
  closes back OUTSIDE it in the reversal direction (matches the "touch + close
  back out" rejection pattern used throughout this project's other strategies),
  not merely touching it.
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.ict import FairValueGap, FvgTracker, SwingTracker
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"
_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class CisdStrategy(Strategy):
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
        self.trend: Optional[str] = None
        self.watch_zone: Optional[FairValueGap] = None
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
        new_fvg = self.fvg.update(bar)

        shift = self.swings.structure_shift(bar)
        if shift == "bullish":
            self.trend = "up"
        elif shift == "bearish":
            self.trend = "down"

        if self.watch_zone is None and new_fvg is not None:
            if self.trend == "up" and new_fvg.direction == "bearish":
                self.watch_zone = new_fvg
            elif self.trend == "down" and new_fvg.direction == "bullish":
                self.watch_zone = new_fvg

        max_per_session = self.params.get("max_trades_per_session", 3)
        if self.watch_zone is None or ctx.has_open("Long") or ctx.has_open("Short"):
            return
        if self.trades_this_session >= max_per_session:
            self.watch_zone = None
            return

        gap = self.watch_zone
        if gap.filled:
            # Invalidated the OTHER way (broke clean through instead of
            # rejecting) before ever giving a valid signal -- stale, drop it.
            self.watch_zone = None
            return
        touched = bar.low <= gap.top and bar.high >= gap.bottom
        if not touched:
            return

        if gap.direction == "bearish" and bar.close < gap.bottom:
            target = self.swings.last_swing_low
            if target is not None and target.price < bar.close:
                ctx.enter(Direction.SHORT, gap.top, target.price, self.contracts, self._session_label(bar), tag="Short")
                self.trades_this_session += 1
            self.watch_zone = None
        elif gap.direction == "bullish" and bar.close > gap.top:
            target = self.swings.last_swing_high
            if target is not None and target.price > bar.close:
                ctx.enter(Direction.LONG, gap.bottom, target.price, self.contracts, self._session_label(bar), tag="Long")
                self.trades_this_session += 1
            self.watch_zone = None
