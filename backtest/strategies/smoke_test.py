from __future__ import annotations

from engine.bar import Bar
from engine.sessions import SessionWindow
from engine.strategy import Direction, EngineContext, Outcome, SessionKey, Strategy


class SmokeTestStrategy(Strategy):
    """Not a real trading strategy — proves the ingest -> bars_store -> runner ->
    ClosedTrade pipeline works end-to-end (Phase 1 verification only). Rule: go long
    on the first bar of the New York session each day, fixed-tick target and stop,
    force-flat if still open by the end of that session (so a daily trade actually
    gets exercised instead of one position drifting open for weeks)."""

    SESSION_WINDOWS = {
        SessionKey.NEW_YORK: SessionWindow(
            label="New York", start_hour=9, start_minute=30, end_hour=16, end_minute=0, zone="America/New_York"
        ),
    }

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        if not ctx.has_open("Long"):
            return
        minutes = ctx.minutes_since_session_open(SessionKey.NEW_YORK, bar)
        if minutes is not None and minutes >= 389:
            ctx.close("Long", Outcome.CLOSED_AT_DAY_END)

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        if session != SessionKey.NEW_YORK or ctx.has_open("Long"):
            return
        tick = self.instrument.tick_size
        target_ticks = self.params.get("target_ticks", 10)
        stop_ticks = self.params.get("stop_ticks", 10)
        ctx.enter(
            direction=Direction.LONG,
            stop_price=bar.close - stop_ticks * tick,
            target_price=bar.close + target_ticks * tick,
            contracts=self.params.get("contracts", 1),
            session=session,
            tag="Long",
        )
