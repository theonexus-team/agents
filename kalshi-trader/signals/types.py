from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


@dataclass(frozen=True)
class Signal:
    direction: Direction
    occurred_at: datetime
    window_start: datetime
    window_close_at: datetime
    strategy: str
    # orb15_vwap-specific context; None for strategies (e.g. algo2) that don't have
    # an opening-range/VWAP concept - kept nullable rather than forcing a fake value.
    vwap_value: Optional[float] = None
    or_high: Optional[float] = None
    or_low: Optional[float] = None
