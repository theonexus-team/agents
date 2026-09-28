"""Port of tradingview/theonexus-ob-reversal.pine ("Theonexus - OB Reversal" —
public display name "Revenge", see src/lib/strategyNames.ts).

Order-block rejection reversal. Not session-gated for trading (watches
continuously) — session windows here are only for the per-session trade cap
reset and the session label stored on each trade, matching Algo 2's own
identical session-labeling pattern (same GMT+7 windows, same script).

Order-block detection reuses engine.orderblocks (CC BY-NC-SA 4.0, see that
module's header) — identical algorithm to orb_vwap.py/algo2_first_touch.py, but
this strategy gets its own OrderBlockTracker instance (matches the Pine source:
each script/chart instance tracks its own blocks independently).

Unlike Algo 2, this strategy has NO zone-to-zone targeting and NO touch-tick
tolerance — the Pine source uses a fixed tick target and an exact (zero-
tolerance) touch check (`low <= obTop and high >= obBottom`, nothing added).
Trailing stop is handled by the engine's generic mechanism (see
engine/runner.py._apply_trailing_stops) via `trail_arm_profit`/`trail_ticks` —
not reimplemented here, same as every other ported strategy.

Fidelity note: `min_age_bars` is checked against real bar-index age here, not
Pine's millisecond arithmetic — see engine/orderblocks.py's OrderBlock.bar_end_idx
docstring for why that's an equivalent, timeframe-agnostic translation.

Target ticks/contracts: the Pine source hardcodes a binary HG-vs-everything-else
split (`symbolChoice == "HG" ? 20 : 80` ticks, `? 1 : 4` contracts) — reproduced
here the same way via params, rather than a per-symbol table, since that's
exactly what the live script does and MES was never in that script's symbol
list. tickDollarValue is NOT reproduced from Pine's own hardcoded table (which
doesn't know about MES) — the engine's trailing-stop mechanism already uses
`self.instrument.tick_value` directly, which is correct for every onboarded
symbol including MES.
"""

from __future__ import annotations

from typing import Optional

from engine.bar import Bar
from engine.orderblocks import OrderBlock, OrderBlockTracker
from engine.sessions import SessionWindow, bar_in_session
from engine.strategy import Direction, EngineContext, SessionKey, Strategy

_GMT7 = "Etc/GMT-7"

_PRIORITY = [SessionKey.TOKYO, SessionKey.SHANGHAI, SessionKey.LONDON]


class ObReversalStrategy(Strategy):
    SESSION_WINDOWS = {
        SessionKey.TOKYO: SessionWindow("Tokyo", 7, 0, 16, 0, _GMT7),
        SessionKey.SHANGHAI: SessionWindow("Shanghai", 8, 0, 15, 0, _GMT7),
        SessionKey.LONDON: SessionWindow("London", 15, 0, 23, 40, _GMT7),
        SessionKey.NEW_YORK: SessionWindow("New York", 20, 30, 4, 0, _GMT7),
    }

    def __init__(self, params: dict, instrument):
        super().__init__(params, instrument)
        is_hg = instrument.symbol == "HG"
        self.target_ticks = params.get("hg_target_ticks", 20) if is_hg else params.get("default_target_ticks", 80)
        self.contracts = params.get("hg_contracts", 1) if is_hg else params.get("default_contracts", 4)

        self.ob_tracker = OrderBlockTracker(
            struct_len=params.get("ob_struct_len", 9),
            keep_count=params.get("ob_keep_count", 2),
        )
        self.trades_this_session = 0
        self.pending_buy_block: Optional[OrderBlock] = None
        self.pending_sell_block: Optional[OrderBlock] = None

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        # Matches `if anySessionSwitch: obrTradesThisSession := 0` — reset on ANY
        # of the 4 sessions switching, not scoped to one specific session.
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

        # 1) Fire an entry armed on the PRIOR bar — order matters, this is what
        # makes it a one-bar delay rather than same-bar (Pine: "take the next
        # candle out to make sure"). Stop = the block's own edge (the value
        # that rejected); target = a fixed tick distance, not zone-to-zone.
        if self.pending_buy_block is not None:
            stop = self.pending_buy_block.value
            entry_px = bar.close
            target_px = entry_px + self.instrument.tick_size * self.target_ticks
            self.trades_this_session += 1
            ctx.enter(Direction.LONG, stop, target_px, self.contracts, session_label, tag="Long")
            self.pending_buy_block = None

        if self.pending_sell_block is not None:
            stop = self.pending_sell_block.value
            entry_px = bar.close
            target_px = entry_px - self.instrument.tick_size * self.target_ticks
            self.trades_this_session += 1
            ctx.enter(Direction.SHORT, stop, target_px, self.contracts, session_label, tag="Short")
            self.pending_sell_block = None

        # 2) Detect a fresh rejection candle to arm for the NEXT bar. Blocked
        # once the per-session cap is reached, the strategy is disabled, or a
        # position is already open (this strategy holds at most one position at
        # a time) — an already-pending entry above still fires either way.
        if not self.params.get("enabled", True):
            return
        max_per_session = self.params.get("max_trades_per_session", 3)
        session_cap_reached = self.trades_this_session >= max_per_session
        already_open = ctx.has_open("Long") or ctx.has_open("Short")
        if (
            session_cap_reached
            or already_open
            or self.pending_buy_block is not None
            or self.pending_sell_block is not None
        ):
            return

        touched_buy = self._find_touched_bullish(bar, current_idx)
        # Nested `if`, not `and both sides` — mirrors the Pine source's own
        # comment: only check the bearish side once we know there's no bullish
        # touch, and only read `.value` once we're sure we have a block.
        #
        # `.broken` is only set on a CONFIRMED rejection (close outside the
        # block), not on every touch — unlike algo2_first_touch.py's "first
        # touch only" consumption. A touch that doesn't confirm rejection (price
        # wicks in but closes back inside) leaves the block untouched-looking and
        # eligible again next bar, until it either rejects (consumed + traded)
        # or the OrderBlockTracker's own close-through invalidation removes it.
        if touched_buy is not None:
            if bar.close > (touched_buy.value + self.ob_tracker.atr):
                touched_buy.broken = True
                self.pending_buy_block = touched_buy
        else:
            touched_sell = self._find_touched_bearish(bar, current_idx)
            if touched_sell is not None:
                if bar.close < (touched_sell.value - self.ob_tracker.atr):
                    touched_sell.broken = True
                    self.pending_sell_block = touched_sell

    # -- Touch detection (exact bounds, no tick tolerance — matches Pine) --------

    def _find_touched_bullish(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        min_age_bars = self.params.get("min_age_bars", 3)
        for ob in reversed(self.ob_tracker.bullish):
            top, bottom = ob.value + self.ob_tracker.atr, ob.value
            if not ob.broken and (current_idx - ob.bar_end_idx) >= min_age_bars and bar.low <= top and bar.high >= bottom:
                return ob
        return None

    def _find_touched_bearish(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        min_age_bars = self.params.get("min_age_bars", 3)
        for ob in reversed(self.ob_tracker.bearish):
            top, bottom = ob.value, ob.value - self.ob_tracker.atr
            if not ob.broken and (current_idx - ob.bar_end_idx) >= min_age_bars and bar.low <= top and bar.high >= bottom:
                return ob
        return None
