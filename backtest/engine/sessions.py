from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

UTC = ZoneInfo("UTC")


@dataclass(frozen=True)
class SessionWindow:
    """One strategy's definition of a trading session — start/end time-of-day in a
    given IANA timezone. Mirrors a Pine input.session() default (e.g. Algo 2's Tokyo
    window "0700-1600"). This is strategy config, not shared engine state, since
    different .pine files use slightly different session boundaries — each ported
    Strategy declares its own SessionWindow set matching its source script."""

    label: str
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    zone: str  # IANA timezone name, e.g. "America/New_York"


def _bounds_for_day(window: SessionWindow, bar_ts: datetime) -> tuple[datetime, datetime]:
    tz = ZoneInfo(window.zone)
    local = bar_ts.astimezone(tz)
    start = local.replace(hour=window.start_hour, minute=window.start_minute, second=0, microsecond=0)
    end = local.replace(hour=window.end_hour, minute=window.end_minute, second=0, microsecond=0)
    if end <= start:
        end += timedelta(days=1)
    if local < start:
        start -= timedelta(days=1)
        end -= timedelta(days=1)
    return start, end


def bar_in_session(window: SessionWindow, bar_ts: datetime) -> bool:
    start, end = _bounds_for_day(window, bar_ts)
    local = bar_ts.astimezone(ZoneInfo(window.zone))
    return start <= local < end


def session_open_time(window: SessionWindow, bar_ts: datetime) -> Optional[datetime]:
    if not bar_in_session(window, bar_ts):
        return None
    start, _ = _bounds_for_day(window, bar_ts)
    return start.astimezone(UTC)


def minutes_since_open(window: SessionWindow, bar_ts: datetime) -> Optional[float]:
    opened = session_open_time(window, bar_ts)
    if opened is None:
        return None
    return (bar_ts.astimezone(UTC) - opened).total_seconds() / 60.0


def trading_day_start(from_ts: datetime) -> datetime:
    """Start of the real futures trading day: 6pm ET to 5pm ET the next day. Port of
    src/lib/sessions.ts tradingDayStart() — kept for Phase 4 forward-test bookkeeping
    parity with the live risk engine."""
    ny = from_ts.astimezone(ZoneInfo("America/New_York"))
    start = ny.replace(hour=18, minute=0, second=0, microsecond=0)
    if ny.hour < 18:
        start -= timedelta(days=1)
    return start.astimezone(UTC)
