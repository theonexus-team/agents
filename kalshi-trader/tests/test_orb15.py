import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from feed.bar_aggregator import Bar
from signals.orb15 import Direction, Orb15VwapSignal

WINDOW_START = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)


def bar(minute: int, o: float, h: float, l: float, c: float) -> Bar:
    return Bar(WINDOW_START + timedelta(minutes=minute), o, h, l, c, volume=1.0)


def test_clean_breakout_continuation_fires_long():
    sig = Orb15VwapSignal()
    # Opening range bar: 100-101.
    assert sig.on_bar(bar(0, 100, 101, 100, 100.5)) is None
    # Warm up VWAP below the eventual breakout so the VWAP gate passes.
    for i in range(1, 4):
        assert sig.on_bar(bar(i, 100.5, 100.6, 100.4, 100.5)) is None
    # Breakout above OR high -> arms LONG.
    assert sig.on_bar(bar(4, 100.5, 102, 100.5, 102)) is None
    # Confirmation bar still above OR high -> continuation fires, VWAP gate passes.
    result = sig.on_bar(bar(5, 102, 103, 102, 103))
    assert result is not None
    assert result.direction is Direction.LONG


def test_reversal_back_inside_range_flips_and_can_fire_short():
    sig = Orb15VwapSignal()
    assert sig.on_bar(bar(0, 100, 101, 100, 100.5)) is None
    # Breakout above OR high arms LONG (must stay inside the 6-min breakout window).
    assert sig.on_bar(bar(1, 100.5, 102, 100.5, 102)) is None
    # Back inside the range -> re-arms SHORT instead of firing continuation.
    assert sig.on_bar(bar(2, 102, 102, 99, 99.5)) is None
    # Confirmation below OR low, VWAP now above price (bearish gate) -> fires SHORT.
    result = sig.on_bar(bar(3, 99.5, 99.5, 98, 98))
    assert result is not None
    assert result.direction is Direction.SHORT


def test_no_breakout_within_window_never_fires():
    sig = Orb15VwapSignal()
    assert sig.on_bar(bar(0, 100, 101, 100, 100.5)) is None
    for i in range(1, 15):
        assert sig.on_bar(bar(i, 100.5, 100.7, 100.3, 100.5)) is None


def test_fires_at_most_once_per_window():
    sig = Orb15VwapSignal()
    sig.on_bar(bar(0, 100, 101, 100, 100.5))
    for i in range(1, 4):
        sig.on_bar(bar(i, 100.5, 100.6, 100.4, 100.5))
    sig.on_bar(bar(4, 100.5, 102, 100.5, 102))
    first = sig.on_bar(bar(5, 102, 103, 102, 103))
    assert first is not None
    # Further bars in the same window must not fire again even if price keeps moving.
    second = sig.on_bar(bar(6, 103, 105, 103, 105))
    assert second is None
