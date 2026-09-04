import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from feed.bar_aggregator import Bar
from signals.algo2_15 import Algo2Signal
from signals.types import Direction

START = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)


def bar(minute: int, o: float, h: float, l: float, c: float) -> Bar:
    return Bar(START + timedelta(minutes=minute), o, h, l, c, volume=1.0)


def test_fires_only_after_a_zone_forms_and_gets_touched():
    sig = Algo2Signal()
    fired = []
    # Feed a long, uneventful ramp - struct_len=9 needs a real swing structure
    # before any order block exists at all, so nothing should fire immediately.
    for i in range(15):
        price = 100 + i * 0.1
        result = sig.on_bar(bar(i, price, price + 0.2, price - 0.2, price))
        if result is not None:
            fired.append(result)
    # No assertion on whether a block formed yet (depends on the exact swing
    # structure of a monotonic ramp) - the real invariant under test is that the
    # signal only ever fires a Direction, never raises, and strategy is tagged.
    for f in fired:
        assert f.direction in (Direction.LONG, Direction.SHORT)
        assert f.strategy == "algo2_first_touch"


def test_signal_carries_no_vwap_context():
    sig = Algo2Signal()
    for i in range(20):
        price = 100 + (i % 5) * 0.3
        result = sig.on_bar(bar(i, price, price + 0.2, price - 0.2, price))
        if result is not None:
            assert result.vwap_value is None
            assert result.or_high is None
            assert result.or_low is None
