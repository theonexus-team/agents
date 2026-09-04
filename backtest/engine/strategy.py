from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Optional

from .bar import Bar, InstrumentSpec
from .sessions import SessionWindow


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class SessionKey(str, Enum):
    TOKYO = "TOKYO"
    SHANGHAI = "SHANGHAI"
    LONDON = "LONDON"
    NEW_YORK = "NEW_YORK"


class Outcome(str, Enum):
    """Mirrors the Prisma Outcome enum exactly — values are written verbatim into
    BacktestTrade.outcome."""

    HIT_TARGET = "HIT_TARGET"
    STOPPED_OUT = "STOPPED_OUT"
    STOPPED_OUT_TARGET_HIT_LATER = "STOPPED_OUT_TARGET_HIT_LATER"
    CLOSED_AT_DAY_END = "CLOSED_AT_DAY_END"
    MANUAL_FLATTEN = "MANUAL_FLATTEN"


class FillTieBreak(str, Enum):
    """When one bar's [low, high] range contains both a position's stop and target,
    OHLC data alone can't say which was hit first — the same ambiguity Pine's own
    backtester has on standard bars. STOP_FIRST is the default: a backtest shouldn't
    look better than reality by resolving every ambiguous bar in the trader's favor."""

    STOP_FIRST = "stop_first"
    TARGET_FIRST = "target_first"


class EngineContext(ABC):
    """The strategy's only way to act. Implemented by runner.py; a Strategy never
    manages simulated positions directly."""

    @abstractmethod
    def enter(
        self,
        direction: Direction,
        stop_price: float,
        target_price: float,
        contracts: int,
        session: SessionKey,
        tag: str = "default",
    ) -> None:
        """Fills at the current bar's close (mirrors process_orders_on_close=true).
        Target/stop against subsequent bars is handled automatically by the engine —
        the strategy does not need to check for its own exits."""

    @abstractmethod
    def update_stop(self, tag: str, new_stop_price: float) -> None:
        """Tighten (or set) the stop for an open position — how a strategy implements
        a trailing stop. Takes effect starting the next bar's automatic exit check."""

    @abstractmethod
    def close(self, tag: str, outcome: Outcome, exit_price: Optional[float] = None) -> None:
        """Force-close at exit_price, or at the current bar's close if exit_price is
        None (a force-flat / manual-flatten style exit)."""

    @abstractmethod
    def has_open(self, tag: str = "default") -> bool: ...

    @abstractmethod
    def session_open_time(self, session: SessionKey) -> Optional[datetime]: ...

    @abstractmethod
    def minutes_since_session_open(self, session: SessionKey, bar: Bar) -> Optional[float]: ...

    def scaled_contracts(self) -> Optional[int]:
        """Dynamic contract count from shared portfolio equity (engine.portfolio.
        PortfolioState's drawdown-from-peak/profit-from-start ladder), when this
        strategy is running inside a PortfolioRunner. Concrete (not abstract) with a
        default of None — a standalone single-strategy BacktestRunner has no
        portfolio attached, so this is simply unavailable there; a strategy that
        wants dynamic sizing calls `ctx.scaled_contracts() or self.contracts` and
        gets its own fixed size back in that case, no special-casing needed."""
        return None


class Strategy(ABC):
    """One instance per backtest run. on_bar() is called once per bar in chronological
    order; state (order blocks, armed/pending setups, trailing-stop bookkeeping) lives
    on self between calls — the same mental model as a Pine script's persistent var."""

    #: Strategy-declared session windows, keyed by SessionKey — matches this
    #: strategy's source .pine file's own input.session() defaults. Subclasses that
    #: are session-aware should override this.
    SESSION_WINDOWS: dict[SessionKey, SessionWindow] = {}

    def __init__(self, params: dict, instrument: InstrumentSpec):
        self.params = params
        self.instrument = instrument

    @abstractmethod
    def on_bar(self, bar: Bar, ctx: EngineContext) -> None: ...

    def on_session_start(self, session: SessionKey, bar: Bar, ctx: EngineContext) -> None:
        """Optional. Fires once on the first bar of a session — mirrors the newSession
        pulse used to reset one-trade-per-session state in the live scripts."""

    def serialize_state(self) -> Optional[dict]:
        """Optional — needed by Phase 4 forward-test to resume a strategy incrementally
        instead of replaying from scratch each time."""
        return None

    def restore_state(self, state: dict) -> None:
        """Optional counterpart to serialize_state()."""
