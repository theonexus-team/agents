from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class Bar:
    ts: datetime  # UTC
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None


@dataclass(frozen=True)
class InstrumentSpec:
    symbol: str
    tick_size: float
    tick_value: float
