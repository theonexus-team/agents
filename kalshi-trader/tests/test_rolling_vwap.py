import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from feed.bar_aggregator import Bar
from signals.rolling_vwap import RollingVwap


def make_bar(minute_offset: int, price: float, volume: float = 1.0) -> Bar:
    ts = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(minutes=minute_offset)
    return Bar(ts, price, price, price, price, volume)


def naive_vwap(bars: list[Bar]) -> float:
    total_pv = sum((b.high + b.low + b.close) / 3 * b.volume for b in bars)
    total_vol = sum(b.volume for b in bars)
    return total_pv / total_vol


def test_matches_naive_recompute_within_window():
    vwap = RollingVwap(window_minutes=5)
    bars = [make_bar(i, 100 + i, volume=2.0) for i in range(5)]
    for b in bars:
        vwap.add_bar(b)
    assert abs(vwap.value - naive_vwap(bars)) < 1e-9


def test_drops_bars_outside_window():
    vwap = RollingVwap(window_minutes=3)
    bars = [make_bar(i, 100 + i, volume=1.0) for i in range(6)]
    for b in bars:
        vwap.add_bar(b)
    assert abs(vwap.value - naive_vwap(bars[-3:])) < 1e-9


def test_no_value_before_any_bars():
    vwap = RollingVwap(window_minutes=5)
    assert vwap.value is None
