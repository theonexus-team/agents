from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Iterable, Optional

from .bar import Bar, InstrumentSpec
from .pnl import compute_close_pnl
from .sessions import minutes_since_open, session_open_time
from .strategy import Direction, EngineContext, FillTieBreak, Outcome, SessionKey, Strategy

if TYPE_CHECKING:
    from .portfolio import PortfolioState


@dataclass
class ClosedTrade:
    """Shape mirrors the Prisma Trade/BacktestTrade model field-for-field, plus
    initial_stop_price (not a Trade column — used only to compute perDollarRisked).

    No worst_point/best_point here: the live webhook (src/app/api/webhook/tradingview/
    route.ts) never receives a true intrabar excursion from the Pine scripts either —
    neither script's exit alert JSON includes those fields — so it falls back to
    `min(0, net)` / `max(0, net)`, a dollar-scale proxy computed AT CLOSE, not a
    tracked price extremum. engine/db.py computes the same proxy from `net` right
    where net itself is computed, matching live exactly instead of inventing a more
    "accurate" number the live system doesn't actually have either."""

    direction: Direction
    session: SessionKey
    entry_price: float
    exit_price: float
    opened_at: datetime
    closed_at: datetime
    outcome: Outcome
    contracts: Optional[int]
    initial_stop_price: float


@dataclass
class _OpenPosition:
    tag: str
    direction: Direction
    session: SessionKey
    entry_price: float
    stop_price: float
    initial_stop_price: float
    target_price: float
    contracts: Optional[int]
    opened_at: datetime
    trail_armed: bool = False


class _RunnerContext(EngineContext):
    """Runner-owned implementation of EngineContext — one per BacktestRunner instance,
    reused across the whole run. Strategies never touch _open directly."""

    def __init__(self, runner: "BacktestRunner"):
        self._runner = runner

    def enter(self, direction, stop_price, target_price, contracts, session, tag="default") -> None:
        self._runner._enter(direction, stop_price, target_price, contracts, session, tag)

    def update_stop(self, tag, new_stop_price) -> None:
        self._runner._update_stop(tag, new_stop_price)

    def close(self, tag, outcome, exit_price=None) -> None:
        self._runner._force_close(tag, outcome, exit_price)

    def has_open(self, tag="default") -> bool:
        return tag in self._runner._open

    def session_open_time(self, session: SessionKey) -> Optional[datetime]:
        window = self._runner._strategy.SESSION_WINDOWS.get(session)
        if window is None or self._runner._current_bar is None:
            return None
        return session_open_time(window, self._runner._current_bar.ts)

    def minutes_since_session_open(self, session: SessionKey, bar: Bar) -> Optional[float]:
        window = self._runner._strategy.SESSION_WINDOWS.get(session)
        if window is None:
            return None
        return minutes_since_open(window, bar.ts)

    def scaled_contracts(self) -> Optional[int]:
        if self._runner._portfolio is None:
            return None
        return self._runner._portfolio.scaled_contracts()


class BacktestRunner:
    """Bar-by-bar event loop. One instrument/timeframe per run, matching how the live
    Pine scripts each run on a single chart instance."""

    def __init__(
        self,
        strategy: Strategy,
        instrument: InstrumentSpec,
        fill_tie_break: FillTieBreak = FillTieBreak.STOP_FIRST,
        portfolio: Optional["PortfolioState"] = None,
        risk_per_trade: float = 150.0,
    ):
        self._strategy = strategy
        self._instrument = instrument
        self._fill_tie_break = fill_tie_break
        # When set (by engine.portfolio.PortfolioRunner running several legs on one
        # shared account), every closed trade's dollar net gets reported to it
        # immediately — not deferred to db.py/cli.py's usual post-hoc pnl pass —
        # because a dynamically-sized strategy (ctx.scaled_contracts()) needs to see
        # updated equity/drawdown BEFORE its next entry decision, not after the run
        # finishes. risk_per_trade only matters for the normalized-risk pnl fallback
        # (contracts+tickValue+tickSize all present covers every strategy here).
        self._portfolio = portfolio
        self._risk_per_trade = risk_per_trade
        self._open: dict[str, _OpenPosition] = {}
        self._closed: list[ClosedTrade] = []
        self._current_bar: Optional[Bar] = None
        # Keyed by session -> that session's own open timestamp, the last time it
        # fired. NOT a simple "was active on the previous processed bar" set: real
        # exports (and RTH-only exports especially) can have zero bars between one
        # day's session close and the next day's open, so there may never be an
        # "inactive" bar to observe in between. Comparing against the session's own
        # freshly-computed open time instead fires exactly once per calendar day
        # regardless of whether any off-session bars exist in the data.
        self._last_session_open: dict[SessionKey, datetime] = {}
        self._ctx = _RunnerContext(self)

    def run(self, bars: Iterable[Bar]) -> list[ClosedTrade]:
        for bar in bars:
            self.step(bar)
        return self._closed

    def step(self, bar: Bar) -> None:
        """Processes exactly one bar. Split out from run() so engine.portfolio.
        PortfolioRunner can drive several legs (different instruments, different
        bar streams) in merged chronological order, one bar at a time, instead of
        each leg running its whole history in isolation."""
        self._current_bar = bar

        # New-session detection, fired before anything else on the bar so a
        # strategy's on_session_start can reset per-session state (trade counts,
        # armed setups) before on_bar sees this bar. Also un-arms the trailing
        # stop on any position carried over from a prior session into this one
        # (matches the Pine scripts' own `var trailArmed` being session-scoped
        # and reset on newSession even when a position isn't).
        for key, window in self._strategy.SESSION_WINDOWS.items():
            opened_at = session_open_time(window, bar.ts)
            if opened_at is not None and self._last_session_open.get(key) != opened_at:
                self._last_session_open[key] = opened_at
                for pos in self._open.values():
                    if pos.session == key:
                        pos.trail_armed = False
                self._strategy.on_session_start(key, bar, self._ctx)

        # Generic force-flat / trailing-stop mechanics, driven by optional
        # strategy params (force_flat_minutes, trail_arm_profit, trail_ticks).
        # Both live scripts implement these identically, so they're engine-level
        # rather than duplicated per strategy. Order matters and mirrors the
        # Pine source's own top-to-bottom bar execution: force-flat, then
        # trailing-stop update (which can affect THIS bar's exit check below,
        # since Pine variables are read-after-write within one bar), then the
        # exit check itself — entries (on_bar, below) always come last, so a
        # position opened this bar is never checked against its own bar.
        self._apply_force_flat(bar)
        self._apply_trailing_stops(bar)

        # Target/stop exit check against THIS bar, for positions opened on a
        # strictly earlier bar (a position opened on bar N is never checked
        # against bar N's own range — it didn't exist yet during that bar).
        self._check_exits(bar)

        # Strategy reacts: may enter new positions. (Trailing/force-flat are
        # handled generically above, not by the strategy's own on_bar.)
        self._strategy.on_bar(bar, self._ctx)

    def _apply_force_flat(self, bar: Bar) -> None:
        flat_minutes = self._strategy.params.get("force_flat_minutes")
        if flat_minutes is None:
            return
        for tag in list(self._open.keys()):
            pos = self._open[tag]
            if pos.opened_at >= bar.ts:
                continue
            # Measured from the position's own entry, not from session open — a
            # reversal entry can fire arbitrarily late in the session (the
            # failed-breakout watch loop has no cutoff), so counting from session
            # open could force-flatten a fresh entry within minutes of opening,
            # during a drawdown it never got a chance to recover from. Matches the
            # equivalent fix in the live Pine script (entryTime, not sessionOpenTime).
            minutes = (bar.ts - pos.opened_at).total_seconds() / 60
            if minutes >= flat_minutes:
                self._force_close(tag, Outcome.CLOSED_AT_DAY_END, bar.close)

    def _apply_trailing_stops(self, bar: Bar) -> None:
        trail_arm_profit = self._strategy.params.get("trail_arm_profit")
        trail_ticks = self._strategy.params.get("trail_ticks")
        if trail_arm_profit is None or trail_ticks is None:
            return
        tick_size = self._instrument.tick_size
        tick_value = self._instrument.tick_value
        trail_distance = trail_ticks * tick_size
        for pos in self._open.values():
            if pos.opened_at >= bar.ts or not pos.contracts:
                continue
            if pos.direction == Direction.LONG:
                floating_profit = ((bar.high - pos.entry_price) / tick_size) * tick_value * pos.contracts
                if not pos.trail_armed and floating_profit >= trail_arm_profit:
                    pos.trail_armed = True
                if pos.trail_armed:
                    pos.stop_price = max(pos.stop_price, bar.high - trail_distance)
            else:
                floating_profit = ((pos.entry_price - bar.low) / tick_size) * tick_value * pos.contracts
                if not pos.trail_armed and floating_profit >= trail_arm_profit:
                    pos.trail_armed = True
                if pos.trail_armed:
                    pos.stop_price = min(pos.stop_price, bar.low + trail_distance)

    # -- EngineContext-facing operations -------------------------------------------------

    def _enter(self, direction, stop_price, target_price, contracts, session, tag) -> None:
        if tag in self._open or self._current_bar is None:
            return
        bar = self._current_bar
        self._open[tag] = _OpenPosition(
            tag=tag,
            direction=direction,
            session=session,
            entry_price=bar.close,
            stop_price=stop_price,
            initial_stop_price=stop_price,
            target_price=target_price,
            contracts=contracts,
            opened_at=bar.ts,
        )

    def _update_stop(self, tag, new_stop_price) -> None:
        pos = self._open.get(tag)
        if pos is not None:
            pos.stop_price = new_stop_price

    def _force_close(self, tag, outcome, exit_price=None) -> None:
        pos = self._open.pop(tag, None)
        if pos is None or self._current_bar is None:
            return
        price = exit_price if exit_price is not None else self._current_bar.close
        trade = self._to_closed_trade(pos, price, outcome, self._current_bar.ts)
        self._closed.append(trade)
        self._report_to_portfolio(trade)

    # -- Automatic per-bar exit mechanics --------------------------------------------------

    def _check_exits(self, bar: Bar) -> None:
        for tag in list(self._open.keys()):
            pos = self._open[tag]
            if pos.opened_at >= bar.ts:
                continue  # opened this bar or later — nothing to check yet

            if pos.direction == Direction.LONG:
                hit_stop = bar.low <= pos.stop_price
                hit_target = bar.high >= pos.target_price
            else:
                hit_stop = bar.high >= pos.stop_price
                hit_target = bar.low <= pos.target_price

            if hit_stop and hit_target:
                if self._fill_tie_break == FillTieBreak.STOP_FIRST:
                    outcome, price = Outcome.STOPPED_OUT, pos.stop_price
                else:
                    outcome, price = Outcome.HIT_TARGET, pos.target_price
            elif hit_stop:
                outcome, price = Outcome.STOPPED_OUT, pos.stop_price
            elif hit_target:
                outcome, price = Outcome.HIT_TARGET, pos.target_price
            else:
                continue

            del self._open[tag]
            trade = self._to_closed_trade(pos, price, outcome, bar.ts)
            self._closed.append(trade)
            self._report_to_portfolio(trade)

    def _report_to_portfolio(self, trade: "ClosedTrade") -> None:
        if self._portfolio is None:
            return
        pnl = compute_close_pnl(
            direction=trade.direction.value,
            entry_price=trade.entry_price,
            stop_price=trade.initial_stop_price,
            exit_price=trade.exit_price,
            contracts=trade.contracts,
            tick_value=self._instrument.tick_value,
            tick_size=self._instrument.tick_size,
            risk_per_trade=self._risk_per_trade,
        )
        self._portfolio.record_trade(pnl.net, trade.closed_at)

    def _to_closed_trade(self, pos: _OpenPosition, exit_price: float, outcome: Outcome, closed_at: datetime) -> ClosedTrade:
        return ClosedTrade(
            direction=pos.direction,
            session=pos.session,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            opened_at=pos.opened_at,
            closed_at=closed_at,
            outcome=outcome,
            contracts=pos.contracts,
            initial_stop_price=pos.initial_stop_price,
        )
