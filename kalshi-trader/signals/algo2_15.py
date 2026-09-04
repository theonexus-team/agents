from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backtest.engine.orderblocks import OrderBlock, OrderBlockTracker  # noqa: E402

import config  # noqa: E402
from feed.bar_aggregator import Bar  # noqa: E402
from market.ticker import window_bounds  # noqa: E402
from signals.types import Direction, Signal  # noqa: E402

ZONE_TOUCH_TOLERANCE_USD = 5.0
MIN_AGE_BARS = 3


class Algo2Signal:
    """Adapted from backtest/strategies/algo2_first_touch.py (order-block first-touch
    rejection) for BTC/Kalshi. Reuses the real OrderBlockTracker from the backtest
    engine directly (CC BY-NC-SA 4.0, see that module's header) rather than
    reimplementing the swing/structure detection - it's instrument- and
    timeframe-agnostic, just fed Bar objects.

    Dropped vs. the futures version: the 4-session cap/reset (no session concept on
    a 24/7 market - the daily trade-count risk limit governs frequency instead), and
    all zone-to-zone BTC-price target/profit-cap logic (we only need a direction -
    execution/manager.py manages the exit entirely on the Kalshi contract's own
    price, never on BTC price, same as orb15). Touch tolerance is a flat USD amount
    instead of instrument ticks, since there's no tick_size concept for BTC here."""

    def __init__(self) -> None:
        self.ob_tracker = OrderBlockTracker(struct_len=9, keep_count=2)
        self.pending_buy_block: Optional[OrderBlock] = None
        self.pending_sell_block: Optional[OrderBlock] = None

    def on_bar(self, bar: Bar) -> Optional[Signal]:
        self.ob_tracker.update(bar)
        current_idx = len(self.ob_tracker.bars) - 1
        window_start, window_close_at = window_bounds(bar.ts)

        result: Optional[Signal] = None

        # Fire an entry armed on the prior bar (one-bar delay, matching the source).
        if self.pending_buy_block is not None:
            result = self._make_signal(Direction.LONG, bar, window_start, window_close_at)
            self.pending_buy_block.trades_taken += 1
            self.pending_buy_block = None
        elif self.pending_sell_block is not None:
            result = self._make_signal(Direction.SHORT, bar, window_start, window_close_at)
            self.pending_sell_block.trades_taken += 1
            self.pending_sell_block = None

        if self.pending_buy_block is None and self.pending_sell_block is None:
            touched_buy = self._find_touched_buy_block(bar, current_idx)
            touched_sell = self._find_touched_sell_block(bar, current_idx)
            if touched_buy is not None:
                # Close outside (above) the buy block = rejection = valid setup.
                rejected = bar.close > (touched_buy.value + self.ob_tracker.atr)
                touched_buy.broken = True
                if rejected:
                    self.pending_buy_block = touched_buy
            elif touched_sell is not None:
                rejected = bar.close < (touched_sell.value - self.ob_tracker.atr)
                touched_sell.broken = True
                if rejected:
                    self.pending_sell_block = touched_sell

        return result

    def _make_signal(self, direction: Direction, bar: Bar, window_start, window_close_at) -> Signal:
        return Signal(
            direction=direction,
            occurred_at=bar.ts,
            window_start=window_start,
            window_close_at=window_close_at,
            strategy="algo2_first_touch",
        )

    def _find_touched_buy_block(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        for ob in reversed(self.ob_tracker.bullish):
            top, bottom = ob.value + self.ob_tracker.atr, ob.value
            eligible = not ob.broken and (current_idx - ob.bar_end_idx) >= MIN_AGE_BARS
            if eligible and bar.low <= top + ZONE_TOUCH_TOLERANCE_USD and bar.high >= bottom - ZONE_TOUCH_TOLERANCE_USD:
                return ob
        return None

    def _find_touched_sell_block(self, bar: Bar, current_idx: int) -> Optional[OrderBlock]:
        for ob in reversed(self.ob_tracker.bearish):
            top, bottom = ob.value, ob.value - self.ob_tracker.atr
            eligible = not ob.broken and (current_idx - ob.bar_end_idx) >= MIN_AGE_BARS
            if eligible and bar.low <= top + ZONE_TOUCH_TOLERANCE_USD and bar.high >= bottom - ZONE_TOUCH_TOLERANCE_USD:
                return ob
        return None
