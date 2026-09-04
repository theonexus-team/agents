"""Port of tradingview/theonexus-orb-breakout.pine ("1m ORB + VWAP").

3-candle-confirmation opening-range breakout across 4 sessions. Order-block
detection/stops reuse engine.orderblocks (CC BY-NC-SA 4.0, see that module's header).

Fidelity notes (see backtest/README.md for the general fill-model caveats):
- Session windows use a fixed GMT+7 offset (Etc/GMT-7), matching the Pine script's
  `tmzn` input default exactly (a static offset, not a DST-observing zone).
- VWAP resets daily at 6pm ET (the same "real futures trading day" boundary already
  used elsewhere in this project), NOT at TradingView's own exchange-session
  calendar reset, which isn't something this engine has access to replicate exactly.
  Documented judgment call, not a silent approximation.
- The opening range for each session is exactly that session's first 1-minute bar's
  high/low (verified against the Pine source: despite get_ohlc()'s general-purpose
  running-accumulator shape, orHigh/orLow are only ever read at the moment they're
  set, which is always the single switch bar itself).
- Force-flat is handled generically by the engine (see engine/runner.py) via the
  force_flat_minutes param below, not by this file's on_bar. No trailing stop —
  removed from both this port and the live Pine script; the target/stop exit is
  the only exit besides force-flat.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from engine.bar import Bar
from engine.orderblocks import OrderBlockTracker
from engine.sessions import SessionWindow, trading_day_start
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"


@dataclass
class _SessionState:
    trade_taken: bool = False
    breakout_dir: int = 0  # 0 = none, 1 = long breakout, -1 = short breakout
    bars_since_breakout: Optional[int] = None
    continuation_confirmed: bool = False
    or_high: Optional[float] = None
    or_low: Optional[float] = None


class OrbVwapStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.TOKYO: SessionWindow("Tokyo", 7, 0, 16, 0, _GMT7),
        SessionKey.SHANGHAI: SessionWindow("Shanghai", 8, 0, 15, 0, _GMT7),
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        self.contracts = params.get("contracts", 1 if instrument.symbol == "HG" else 4)
        self.ob_tracker = OrderBlockTracker(
            struct_len=params.get("ob_struct_len", 9),
            keep_count=params.get("ob_keep_count", 2),
        )
        self.session_state: dict[SessionKey, _SessionState] = {s: _SessionState() for s in SessionKey}

        self.bars_since_bull_bounce = 999_999
        self.bars_since_bear_bounce = 999_999
        self.bull_bounce_recent = False
        self.bear_bounce_recent = False

        self._vwap_day = None
        self._vwap_cum_pv = 0.0
        self._vwap_cum_vol = 0.0
        self.vwap_value: Optional[float] = None
        self.vwap_bias_long = False
        self.vwap_bias_short = False
        self.vwap_ok_long = False
        self.vwap_ok_short = False

    def _entry_contracts(self, ctx: EngineContext) -> int:
        """HG stays fixed, and so does anything explicitly marked sizing_mode="fixed"
        (e.g. an "eval phase" leg using a bigger static size instead of the ladder).
        Otherwise MGC/MNQ use the shared portfolio's dynamic ladder when one is
        attached (engine.portfolio.PortfolioRunner) — same pattern as turtle_soup.py."""
        if self.instrument.symbol == "HG" or self.params.get("sizing_mode") == "fixed":
            return self.contracts
        return ctx.scaled_contracts() or self.contracts

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        state = self.session_state[session]
        state.trade_taken = False
        state.breakout_dir = 0
        state.bars_since_breakout = None
        state.continuation_confirmed = False
        state.or_high = bar.high
        state.or_low = bar.low

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.ob_tracker.update(bar)
        self._update_bounce_state(bar)
        self._update_vwap(bar)
        for session in SessionKey:
            self._manage_session(session, bar, ctx)

    # -- Order-block bounce override (global, once per bar) -----------------------

    def _touched_bullish_ob(self, bar: Bar):
        atr = self.ob_tracker.atr
        for ob in reversed(self.ob_tracker.bullish):
            if not ob.broken and bar.low <= ob.value + atr and bar.high >= ob.value:
                return ob
        return None

    def _touched_bearish_ob(self, bar: Bar):
        atr = self.ob_tracker.atr
        for ob in reversed(self.ob_tracker.bearish):
            if not ob.broken and bar.low <= ob.value and bar.high >= ob.value - atr:
                return ob
        return None

    def _update_bounce_state(self, bar: Bar) -> None:
        atr = self.ob_tracker.atr
        touched_bull = self._touched_bullish_ob(bar)
        touched_bear = self._touched_bearish_ob(bar)
        bull_bounce_now = touched_bull is not None and bar.close > (touched_bull.value + atr)
        bear_bounce_now = touched_bear is not None and bar.close < (touched_bear.value - atr)

        self.bars_since_bull_bounce = 0 if bull_bounce_now else self.bars_since_bull_bounce + 1
        self.bars_since_bear_bounce = 0 if bear_bounce_now else self.bars_since_bear_bounce + 1

        window = self.params.get("trend_override_window_bars", 3)
        self.bull_bounce_recent = self.bars_since_bull_bounce <= window
        self.bear_bounce_recent = self.bars_since_bear_bounce <= window

    def _closed_inside_ob(self, bar: Bar) -> bool:
        if not self.params.get("block_entry_inside_ob", True):
            return False
        atr = self.ob_tracker.atr
        close = bar.close
        inside_bull = any(not ob.broken and ob.value <= close <= ob.value + atr for ob in self.ob_tracker.bullish)
        inside_bear = any(not ob.broken and ob.value - atr <= close <= ob.value for ob in self.ob_tracker.bearish)
        return inside_bull or inside_bear

    def _nearest_bullish_below(self, px: float) -> Optional[float]:
        candidates = [ob.value for ob in self.ob_tracker.bullish if ob.value < px]
        return max(candidates) if candidates else None

    def _nearest_bearish_above(self, px: float) -> Optional[float]:
        candidates = [ob.value for ob in self.ob_tracker.bearish if ob.value > px]
        return min(candidates) if candidates else None

    # -- VWAP directional gate (global, once per bar) ------------------------------

    def _update_vwap(self, bar: Bar) -> None:
        day = trading_day_start(bar.ts)
        if day != self._vwap_day:
            self._vwap_day = day
            self._vwap_cum_pv = 0.0
            self._vwap_cum_vol = 0.0
        typical = (bar.high + bar.low + bar.close) / 3
        vol = bar.volume or 0.0
        self._vwap_cum_pv += typical * vol
        self._vwap_cum_vol += vol
        self.vwap_value = (self._vwap_cum_pv / self._vwap_cum_vol) if self._vwap_cum_vol > 0 else None

        filter_enabled = self.params.get("vwap_filter_enabled", True)
        if not filter_enabled:
            self.vwap_bias_long = True
            self.vwap_bias_short = True
        elif self.vwap_value is None:
            self.vwap_bias_long = False
            self.vwap_bias_short = False
        else:
            self.vwap_bias_long = bar.close > self.vwap_value
            self.vwap_bias_short = bar.close < self.vwap_value

        self.vwap_ok_long = self.vwap_bias_long or self.bull_bounce_recent
        self.vwap_ok_short = self.vwap_bias_short or self.bear_bounce_recent

    # -- Per-session 3-candle confirmation breakout state machine -----------------

    def _manage_session(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        # Matches the Pine source's showTokyo/showShanghai/showLondon/showNewYork
        # inputs — a session listed here never arms a new breakout, though it's
        # generalized to a list here instead of 4 separate booleans.
        if session.value in self.params.get("disabled_sessions", []):
            return
        state = self.session_state[session]
        if state.or_high is None or state.or_low is None:
            return

        minutes = ctx.minutes_since_session_open(session, bar)
        cutoff = self.params.get("breakout_window_minutes", 15)
        past_entry_cutoff = minutes is not None and minutes >= cutoff
        if state.trade_taken or past_entry_cutoff:
            return

        or_high, or_low = state.or_high, state.or_low
        closed_above = bar.close > or_high
        closed_below = bar.close < or_low
        closed_inside = or_low <= bar.close <= or_high

        entry_mode = self.params.get("entry_mode", "both")  # "both" | "continuation_only" | "reversal_only"

        if state.continuation_confirmed:
            vwap_ok = self.vwap_ok_long if state.breakout_dir == 1 else self.vwap_ok_short
            if entry_mode != "reversal_only" and vwap_ok and not self._closed_inside_ob(bar):
                self._fire_entry(session, state.breakout_dir, bar, ctx, state, or_high, or_low)
            state.breakout_dir = 0
            state.bars_since_breakout = None
            state.continuation_confirmed = False

        elif state.bars_since_breakout is not None:
            if state.bars_since_breakout == 0:
                still_outside = closed_above if state.breakout_dir == 1 else closed_below
                if still_outside:
                    state.continuation_confirmed = True
                    state.bars_since_breakout += 1
                elif closed_inside:
                    self._try_reversal_entry(session, state, bar, ctx, or_high, or_low)
                else:
                    state.bars_since_breakout += 1
            else:
                if closed_inside:
                    self._try_reversal_entry(session, state, bar, ctx, or_high, or_low)
                else:
                    state.bars_since_breakout += 1

        else:
            if closed_above or closed_below:
                state.breakout_dir = 1 if closed_above else -1
                state.bars_since_breakout = 0

    def _try_reversal_entry(self, session, state, bar, ctx, or_high, or_low) -> None:
        rev_dir = -state.breakout_dir
        vwap_ok = self.vwap_ok_long if rev_dir == 1 else self.vwap_ok_short
        entry_mode = self.params.get("entry_mode", "both")
        if entry_mode != "continuation_only" and vwap_ok and not self._closed_inside_ob(bar):
            self._fire_entry(session, rev_dir, bar, ctx, state, or_high, or_low)
        state.breakout_dir = 0
        state.bars_since_breakout = None

    def _fire_entry(self, session, direction, bar, ctx, state, or_high, or_low) -> None:
        tick = self.instrument.tick_size
        contracts = self._entry_contracts(ctx)
        # Dollar-based target, not a fixed tick count: matches the live Pine
        # script's minProfitUsd (default $160) — the old fixed 10-tick target
        # cleared for as little as $20-40 on MGC/MNQ, taking trades off long
        # before they'd covered a meaningful move. Ticks needed = whatever it
        # takes to clear min_profit_usd at THIS trade's real contract count
        # (scaled_contracts can vary trade-to-trade, unlike Pine's fixed baseline).
        min_profit_usd = self.params.get("min_profit_usd", 160)
        denom = self.instrument.tick_value * contracts
        target_ticks = math.ceil(min_profit_usd / denom) if denom > 0 else self.params.get("target_ticks", 10)
        if direction == 1:
            ob_stop = self._nearest_bullish_below(bar.close)
            stop = ob_stop if ob_stop is not None else or_low
            target = bar.close + tick * target_ticks
            ctx.enter(Direction.LONG, stop, target, contracts, session, tag=f"{session.value}_Long")
        else:
            ob_stop = self._nearest_bearish_above(bar.close)
            stop = ob_stop if ob_stop is not None else or_high
            target = bar.close - tick * target_ticks
            ctx.enter(Direction.SHORT, stop, target, contracts, session, tag=f"{session.value}_Short")
        state.trade_taken = True
