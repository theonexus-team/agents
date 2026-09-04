"""Inversion FVG — one of 8 ICT concepts from a retail explainer video the user
provided (not a Pine port). Rules as described: a fair value gap that gets
"disrespected" (price closes all the way through it instead of rejecting) flips
role — a bullish FVG that fails becomes resistance, a bearish FVG that fails
becomes support — and price is expected to continue in the direction of the
violation. The video notes this works better combined with other confluence
(higher-timeframe levels); this version trades it standalone, single-timeframe.

Entry fires the SAME bar a gap flips (engine.ict.FvgTracker.just_inverted) — a
failed bullish FVG (price closed below it) => short, stop above the zone, target
the next confirmed swing low. Mirror for a failed bearish FVG => long.
"""

from __future__ import annotations

from engine.bar import Bar
from engine.ict import FvgTracker, SwingTracker
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"
_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class InversionFvgStrategy(Strategy):
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
        self.swings = SwingTracker(lookback=params.get("swing_lookback", 3))
        self.trades_this_session = 0

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        self.trades_this_session = 0

    def _session_label(self, bar: Bar) -> SessionKey:
        for key in _PRIORITY:
            if bar_in_session(self.SESSION_WINDOWS[key], bar.ts):
                return key
        return SessionKey.NEW_YORK

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.fvg.update(bar)
        self.swings.update(bar)
        n = len(self.fvg.bars) - 1

        max_per_session = self.params.get("max_trades_per_session", 3)
        if ctx.has_open("Long") or ctx.has_open("Short") or self.trades_this_session >= max_per_session:
            return

        for gap in self.fvg.just_inverted(n):
            if gap.direction == "bullish":
                # Support failed -> expect continuation down.
                target = self.swings.last_swing_low
                if target is not None and target.price < bar.close:
                    ctx.enter(Direction.SHORT, gap.top, target.price, self.contracts, self._session_label(bar), tag="Short")
                    self.trades_this_session += 1
                    break
            else:
                target = self.swings.last_swing_high
                if target is not None and target.price > bar.close:
                    ctx.enter(Direction.LONG, gap.bottom, target.price, self.contracts, self._session_label(bar), tag="Long")
                    self.trades_this_session += 1
                    break
