"""Silver Bullet — one of 8 ICT concepts from a retail explainer video the user
provided (not a Pine port). Rules as described: session-gated (London or New York
only); wait for price to sweep the day's high/low (wick beyond it, then close back
inside — a liquidity raid, not a confirmed breakout); confirm a market structure
shift in the reversal direction; mark the fair value gap(s) that formed during that
move as the entry zone; enter on a pullback into one of them.

Judgment calls (the source video isn't code, several things need a concrete
definition — documented so they're correctable):
- "Day's high/low" = running high/low since engine.sessions.trading_day_start()
  (the same 6pm-ET real-futures-day boundary used elsewhere in this project), not
  a calendar-midnight day.
- The structure shift must occur within `mss_window_bars` (default 30) of the
  sweep, or the setup expires unconsumed — the video doesn't give a timeout, but
  an unbounded wait risks confirming against a completely unrelated later move.
- "Set a sell/buy limit at the start of the FVG zone" -> entering at market on
  first touch of ANY still-unfilled FVG formed during the sweep-to-shift window
  (same first-touch-consumes pattern algo2_first_touch.py already uses), not a
  resting limit order at a specific edge of the zone.
- Target = the day's opposite-side extreme tracked so far (the natural
  "opposite liquidity pool" ICT setups usually draw toward) — trade is skipped if
  that's not on the profitable side of entry yet (e.g. day's low already below
  where a short would enter).
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.ict import FairValueGap, FvgTracker, SwingTracker
from engine.sessions import SessionWindow, bar_in_session, trading_day_start
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"


class SilverBulletStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        self.contracts = params.get("contracts", 1 if instrument.symbol == "HG" else 4)
        self.swings = SwingTracker(lookback=params.get("swing_lookback", 3))
        self.fvg = FvgTracker()

        self._day = None
        self.day_high: Optional[float] = None
        self.day_low: Optional[float] = None

        # phase: None -> "watching_bear" / "watching_bull" (post-sweep, waiting for
        # MSS) -> "armed_bear" / "armed_bull" (MSS confirmed, holding the FVG pool
        # formed during the move, waiting for a first touch)
        self.phase: Optional[str] = None
        self.phase_started_at: int = 0
        self.armed_pool: list[FairValueGap] = []

    def _update_day(self, bar: Bar) -> None:
        day = trading_day_start(bar.ts)
        if day != self._day:
            self._day = day
            self.day_high = bar.high
            self.day_low = bar.low
            self.phase = None
            self.armed_pool = []
        else:
            self.day_high = max(self.day_high, bar.high)
            self.day_low = min(self.day_low, bar.low)

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        prev_high, prev_low = self.day_high, self.day_low
        self._update_day(bar)
        self.swings.update(bar)
        self.fvg.update(bar)
        n = len(self.fvg.bars) - 1

        session_label = (
            SessionKey.LONDON
            if bar_in_session(self.SESSION_WINDOWS[SessionKey.LONDON], bar.ts)
            else SessionKey.NEW_YORK
            if bar_in_session(self.SESSION_WINDOWS[SessionKey.NEW_YORK], bar.ts)
            else None
        )
        if session_label is None:
            return

        window = self.params.get("mss_window_bars", 30)
        shift = self.swings.structure_shift(bar)

        # Phase 1: detect a sweep of the day's prior high/low (using the day
        # extremes from BEFORE this bar updated them, so the sweep bar itself is
        # what does the sweeping).
        if self.phase is None and prev_high is not None:
            if bar.high > prev_high and bar.close < prev_high:
                self.phase, self.phase_started_at = "watching_bear", n
            elif bar.low < prev_low and bar.close > prev_low:
                self.phase, self.phase_started_at = "watching_bull", n

        elif self.phase == "watching_bear":
            if n - self.phase_started_at > window:
                self.phase = None
            elif shift == "bearish":
                pool = list(self.fvg.unfilled_bearish())
                self.phase = "armed_bear" if pool else None
                self.armed_pool = pool

        elif self.phase == "watching_bull":
            if n - self.phase_started_at > window:
                self.phase = None
            elif shift == "bullish":
                pool = list(self.fvg.unfilled_bullish())
                self.phase = "armed_bull" if pool else None
                self.armed_pool = pool

        elif self.phase == "armed_bear" and not ctx.has_open("Short"):
            touched = next((g for g in self.armed_pool if not g.filled and bar.low <= g.top and bar.high >= g.bottom), None)
            if touched is not None:
                target = self.day_low
                stop = max(g.top for g in self.armed_pool) if self.armed_pool else bar.high
                if target is not None and target < bar.close:
                    ctx.enter(Direction.SHORT, stop, target, self.contracts, session_label, tag="Short")
                self.phase, self.armed_pool = None, []

        elif self.phase == "armed_bull" and not ctx.has_open("Long"):
            touched = next((g for g in self.armed_pool if not g.filled and bar.low <= g.top and bar.high >= g.bottom), None)
            if touched is not None:
                target = self.day_high
                stop = min(g.bottom for g in self.armed_pool) if self.armed_pool else bar.low
                if target is not None and target > bar.close:
                    ctx.enter(Direction.LONG, stop, target, self.contracts, session_label, tag="Long")
                self.phase, self.armed_pool = None, []
