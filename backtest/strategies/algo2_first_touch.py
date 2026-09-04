"""Port of tradingview/theonexus-algo2-first-touch.pine ("Algo 2 First-Touch Zones").

First-touch order-block/zone rejection trading, merged with OB Reversal's session cap
+ min block age + one-bar confirmation delay. Order-block detection reuses
engine.orderblocks (CC BY-NC-SA 4.0, see that module's header) — identical algorithm
to orb_vwap.py, but each strategy instance gets its OWN OrderBlockTracker (matching
the Pine source: each script/chart instance tracks its own blocks independently, not
a single shared tracker across strategies).

Fidelity note: `min_age_bars` is checked against real bar-index age here, not
Pine's millisecond arithmetic (`(time - barEnd) >= minAgeBars * minutesPerBar *
60000`) — see engine/orderblocks.py's OrderBlock.bar_end_idx docstring for why
that's an equivalent, timeframe-agnostic translation rather than an approximation.

`profit_cap_usd` (default $400, mirrors the live Pine script): the zone-to-zone
target was leaving real profit on the table — a trade could exceed $300+ floating
profit and still sit open chasing a distant opposing zone, giving it back on a
reversal. The target now gets pulled in to whatever price corresponds to this many
dollars of profit if the zone-to-zone target implied more, never pushed out if it
was already closer. See `_cap_target`.
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.orderblocks import OrderBlock, OrderBlockTracker
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"

_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class Algo2FirstTouchStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.TOKYO: SessionWindow("Tokyo", 7, 0, 16, 0, _GMT7),
        SessionKey.SHANGHAI: SessionWindow("Shanghai", 8, 0, 15, 0, _GMT7),
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        if instrument.symbol == "MNQ":
            self.contracts = params.get("mnq_contracts", 4)
        elif instrument.symbol == "MGC":
            self.contracts = params.get("mgc_contracts", 4)
        else:
            self.contracts = params.get("hg_contracts", 1)

        self.ob_tracker = OrderBlockTracker(
            struct_len=params.get("ob_struct_len", 9),
            keep_count=params.get("ob_keep_count", 2),
        )
        self.trades_this_session = 0
        self.pending_buy_block: Optional[OrderBlock] = None
        self.pending_sell_block: Optional[OrderBlock] = None

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        # Matches `if anySessionSwitch: tradesThisSession := 0` — reset on ANY of the
        # 4 sessions switching, not scoped to one specific session, since this
        # strategy trades one global position, not per-session slots.
        self.trades_this_session = 0

    def _current_session_label(self, bar: Bar) -> SessionKey:
        for key in _PRIORITY:
            if bar_in_session(self.SESSION_WINDOWS[key], bar.ts):
                return key
        return SessionKey.NEW_YORK

    def on_bar(self, bar: Bar, ctx: EngineContext) -> None:
        self.ob_tracker.update(bar)
        current_idx = len(self.ob_tracker.bars) - 1
        session_label = self._current_session_label(bar)
        zone_to_zone = self.params.get("zone_to_zone_target", True)

        # 1) Fire an entry armed on the PRIOR bar — order matters, this is what
        # makes it a one-bar delay rather than same-bar.
        if self.pending_buy_block is not None:
            target = self._nearest_sell_block_above(bar.close)
            if not zone_to_zone or target is not None:
                stop = self.pending_buy_block.value
                entry_px = bar.close
                target_px = target if zone_to_zone else entry_px + (entry_px - stop)
                target_px = self._cap_target(entry_px, target_px, Direction.LONG)
                self.pending_buy_block.trades_taken += 1
                self.trades_this_session += 1
                ctx.enter(Direction.LONG, stop, target_px, self.contracts, session_label, tag="Long")
            self.pending_buy_block = None

        if self.pending_sell_block is not None:
            target = self._nearest_buy_block_below(bar.close)
            if not zone_to_zone or target is not None:
                stop = self.pending_sell_block.value
                entry_px = bar.close
                target_px = target if zone_to_zone else entry_px - (stop - entry_px)
                target_px = self._cap_target(entry_px, target_px, Direction.SHORT)
                self.pending_sell_block.trades_taken += 1
                self.trades_this_session += 1
                ctx.enter(Direction.SHORT, stop, target_px, self.contracts, session_label, tag="Short")
            self.pending_sell_block = None

        # 2) Detect a fresh touch to arm for the NEXT bar. Blocked once the
        # per-session cap is reached, or this session is explicitly disabled (same
        # "block new arming, let anything already pending still fire" treatment as
        # the session cap gets) — an already-pending entry above still fires either way.
        max_per_session = self.params.get("max_trades_per_session", 3)
        session_cap_reached = self.trades_this_session >= max_per_session
        session_disabled = session_label.value in self.params.get("disabled_sessions", [])
        already_open = ctx.has_open("Long") or ctx.has_open("Short")
        if (
            not session_cap_reached
            and not session_disabled
            and not already_open
            and self.pending_buy_block is None
            and self.pending_sell_block is None
        ):
            touched_buy = self._find_touched_buy_block(bar, current_idx)
            touched_sell = self._find_touched_sell_block(bar, current_idx)
            if touched_buy is not None:
                # Buy Block: close outside (above) it = rejection = valid setup, arm
                # for next bar. Close inside = acceptance = invalid. Either way,
                # first touch consumes the zone.
                rejected = bar.close > (touched_buy.value + self.ob_tracker.atr)
                touched_buy.broken = True
                if rejected:
                    self.pending_buy_block = touched_buy
            elif touched_sell is not None:
                rejected = bar.close < (touched_sell.value - self.ob_tracker.atr)
                touched_sell.broken = True
                if rejected:
                    self.pending_sell_block = touched_sell

    # -- Touch detection (wick-sensitive, tick-tolerant, age-filtered) ------------

    def _find_touched_buy_block(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        tol = self.params.get("zone_touch_tick_tolerance", 1) * self.instrument.tick_size
        first_touch_only = self.params.get("first_touch_only", True)
        max_trades_per_zone = self.params.get("max_trades_per_zone", 1)
        min_age_bars = self.params.get("min_age_bars", 3)
        for ob in reversed(self.ob_tracker.bullish):
            top, bottom = ob.value + self.ob_tracker.atr, ob.value
            eligible = (not ob.broken) if first_touch_only else (ob.trades_taken < max_trades_per_zone)
            eligible = eligible and (current_idx - ob.bar_end_idx) >= min_age_bars
            if eligible and bar.low <= top + tol and bar.high >= bottom - tol:
                return ob
        return None

    def _find_touched_sell_block(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        tol = self.params.get("zone_touch_tick_tolerance", 1) * self.instrument.tick_size
        first_touch_only = self.params.get("first_touch_only", True)
        max_trades_per_zone = self.params.get("max_trades_per_zone", 1)
        min_age_bars = self.params.get("min_age_bars", 3)
        for ob in reversed(self.ob_tracker.bearish):
            top, bottom = ob.value, ob.value - self.ob_tracker.atr
            eligible = (not ob.broken) if first_touch_only else (ob.trades_taken < max_trades_per_zone)
            eligible = eligible and (current_idx - ob.bar_end_idx) >= min_age_bars
            if eligible and bar.low <= top + tol and bar.high >= bottom - tol:
                return ob
        return None

    # -- Zone-to-zone targeting ----------------------------------------------------

    def _nearest_buy_block_below(self, px: float) -> Optional[float]:
        candidates = [ob.value for ob in self.ob_tracker.bullish if ob.value < px]
        return max(candidates) if candidates else None

    def _nearest_sell_block_above(self, px: float) -> Optional[float]:
        candidates = [ob.value for ob in self.ob_tracker.bearish if ob.value > px]
        return min(candidates) if candidates else None

    def _cap_target(self, entry_px: float, target_px: float, direction: Direction) -> float:
        """The opposing zone is sometimes far enough away that a trade sits open
        past a perfectly good profit waiting to "touch the next zone" and gives it
        back on a reversal before ever getting there. Pulls a target IN to whatever
        price corresponds to profit_cap_usd (default $400) if the zone-to-zone
        target implied more than that — never pushes a closer target OUT to chase
        this number."""
        cap_usd = self.params.get("profit_cap_usd", 400)
        if not cap_usd:
            return target_px
        cap_distance = (cap_usd / (self.instrument.tick_value * self.contracts)) * self.instrument.tick_size
        if direction == Direction.LONG:
            return min(target_px, entry_px + cap_distance)
        return max(target_px, entry_px - cap_distance)
