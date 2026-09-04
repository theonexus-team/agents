from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import config
from feed.bar_aggregator import Bar
from market.ticker import window_bounds
from signals.rolling_vwap import RollingVwap
from signals.types import Direction, Signal


class _WindowState:
    def __init__(self, window_start: datetime, window_close_at: datetime) -> None:
        self.window_start = window_start
        self.window_close_at = window_close_at
        self.or_high: Optional[float] = None
        self.or_low: Optional[float] = None
        self.armed_direction: Optional[Direction] = None
        self.armed_at: Optional[datetime] = None
        self.fired = False


class Orb15VwapSignal:
    """Adapted from backtest/strategies/orb_vwap.py for a 24/7, 15-minute-window market:
    no session enum (the 15-min window itself is the boundary), rolling VWAP instead of a
    daily-reset one, order-block bounce override dropped (v1 scope cut). Emits a directional
    Signal only - it never manages a stop/target itself; execution/manager.py owns all exits
    on the Kalshi contract's own price, not on this module's BTC-price signal."""

    def __init__(self) -> None:
        self._vwap = RollingVwap(config.ROLLING_VWAP_MINUTES)
        self._window: Optional[_WindowState] = None

    def on_bar(self, bar: Bar) -> Optional[Signal]:
        self._vwap.add_bar(bar)
        vwap_value = self._vwap.value

        window_start, window_close_at = window_bounds(bar.ts)
        if self._window is None or self._window.window_start != window_start:
            self._window = _WindowState(window_start, window_close_at)

        w = self._window
        if w.or_high is None:
            w.or_high, w.or_low = bar.high, bar.low
            return None

        if w.fired or vwap_value is None:
            return None

        within_breakout_window = bar.ts < window_start + timedelta(minutes=config.BREAKOUT_WINDOW_MINUTES)
        if not within_breakout_window:
            return None

        if w.armed_direction is None:
            if bar.close > w.or_high:
                w.armed_direction, w.armed_at = Direction.LONG, bar.ts
            elif bar.close < w.or_low:
                w.armed_direction, w.armed_at = Direction.SHORT, bar.ts
            return None

        # Confirmation bar: still outside the range in the armed direction = continuation.
        # Back inside the range = reversal, re-arm in the opposite direction instead.
        if w.armed_direction is Direction.LONG:
            if bar.close > w.or_high:
                return self._try_fire(w, Direction.LONG, bar, vwap_value)
            w.armed_direction, w.armed_at = Direction.SHORT, bar.ts
        else:
            if bar.close < w.or_low:
                return self._try_fire(w, Direction.SHORT, bar, vwap_value)
            w.armed_direction, w.armed_at = Direction.LONG, bar.ts
        return None

    def _try_fire(self, w: _WindowState, direction: Direction, bar: Bar, vwap_value: float) -> Optional[Signal]:
        vwap_gate_ok = (direction is Direction.LONG and bar.close > vwap_value) or (
            direction is Direction.SHORT and bar.close < vwap_value
        )
        if not vwap_gate_ok:
            return None
        w.fired = True
        return Signal(
            direction=direction,
            occurred_at=bar.ts,
            window_start=w.window_start,
            window_close_at=w.window_close_at,
            strategy="orb15_vwap",
            vwap_value=vwap_value,
            or_high=w.or_high,
            or_low=w.or_low,
        )
