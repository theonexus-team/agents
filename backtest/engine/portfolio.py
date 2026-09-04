"""Runs several (strategy, instrument) legs simultaneously against ONE shared
account/equity curve — the actual "run these together on one funded account"
simulation, as opposed to engine.runner.BacktestRunner which is scoped to a single
strategy on a single instrument in isolation.

Why this needs true bar-by-bar interleaving instead of just merging each leg's
already-computed trade lists afterward: a leg using dynamic position sizing
(Strategy.scaled_contracts()) needs its CURRENT contract count resolved before each
entry, and for orb_vwap specifically, contract count changes WHEN the trailing stop
arms (it's a fixed-dollar threshold, so more contracts means the same dollar profit
is reached on a smaller price move) — meaning contracts can change which bar a trade
exits on and at what price. That can only be simulated correctly if each leg's bars
are processed in true global chronological order, sharing one live equity figure
between them, not computed once at a fixed size and rescaled after the fact.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .bar import Bar, InstrumentSpec
from .position_sizing import compute_scaled_contracts
from .runner import BacktestRunner, ClosedTrade
from .strategy import FillTieBreak, Strategy


class PortfolioState:
    """Shared equity tracker every leg's BacktestRunner reports into on each trade
    close, and every leg's Strategy.scaled_contracts() reads from before each entry.

    max_loss_from_peak is the account's max-drawdown unit — the SAME $2,000 concept
    already used everywhere else in this project (src/lib/risk.ts's
    MAX_LOSS_FROM_PEAK), but configurable here since a specific prop-firm rule might
    use a different number for a given account size.

    Drawdown is a PURE trailing drawdown (floor = peak_equity - max_loss_from_peak,
    always rising with peak, never capped at starting_balance) — matching this
    project's one existing, already-validated risk model exactly. Some funded
    accounts instead lock the floor at breakeven once profit exceeds the trailing
    amount; this does NOT model that variant — flag it if your actual account works
    that way and this should be adjusted.
    """

    def __init__(self, starting_balance: float, max_loss_from_peak: float = 2000.0):
        self.starting_balance = starting_balance
        self.equity = starting_balance
        self.peak_equity = starting_balance
        self.max_loss_from_peak = max_loss_from_peak
        self.max_drawdown_seen = 0.0
        self.equity_curve: list[tuple[datetime, float]] = []

    def record_trade(self, net: float, closed_at: datetime) -> None:
        self.equity += net
        self.peak_equity = max(self.peak_equity, self.equity)
        self.max_drawdown_seen = max(self.max_drawdown_seen, self.peak_equity - self.equity)
        self.equity_curve.append((closed_at, self.equity))

    @property
    def drawdown_from_peak(self) -> float:
        return max(0.0, self.peak_equity - self.equity)

    @property
    def profit_from_start(self) -> float:
        return max(0.0, self.equity - self.starting_balance)

    def scaled_contracts(self) -> int:
        return compute_scaled_contracts(self.drawdown_from_peak, self.profit_from_start, self.max_loss_from_peak)


@dataclass
class PortfolioLeg:
    strategy: Strategy
    instrument: InstrumentSpec
    bars: list[Bar]
    label: Optional[str] = None  # e.g. "turtle_soup/MNQ", for reporting only


@dataclass
class PortfolioResult:
    state: PortfolioState
    trades_by_leg: dict[str, list[ClosedTrade]] = field(default_factory=dict)

    @property
    def total_net(self) -> float:
        return self.state.equity - self.state.starting_balance


class PortfolioRunner:
    """Drives N legs' BacktestRunners through their bars in true merged chronological
    order (a k-way merge on bar.ts across legs — each leg's own bars must already be
    sorted ascending, which engine.bars_store.read_bars already guarantees), all
    sharing one PortfolioState."""

    def __init__(
        self,
        legs: list[PortfolioLeg],
        starting_balance: float,
        max_loss_from_peak: float = 2000.0,
        fill_tie_break: FillTieBreak = FillTieBreak.STOP_FIRST,
        risk_per_trade: float = 150.0,
    ):
        self.legs = legs
        self.state = PortfolioState(starting_balance, max_loss_from_peak)
        self._runners = [
            BacktestRunner(
                leg.strategy, leg.instrument, fill_tie_break, portfolio=self.state, risk_per_trade=risk_per_trade
            )
            for leg in legs
        ]

    def run(self) -> PortfolioResult:
        import heapq

        heap: list[tuple[datetime, int, int]] = []
        for i, leg in enumerate(self.legs):
            if leg.bars:
                heap.append((leg.bars[0].ts, i, 0))
        heapq.heapify(heap)

        while heap:
            _, leg_idx, bar_idx = heapq.heappop(heap)
            bar = self.legs[leg_idx].bars[bar_idx]
            self._runners[leg_idx].step(bar)
            next_idx = bar_idx + 1
            if next_idx < len(self.legs[leg_idx].bars):
                heapq.heappush(heap, (self.legs[leg_idx].bars[next_idx].ts, leg_idx, next_idx))

        trades_by_leg = {}
        for leg, runner in zip(self.legs, self._runners):
            key = leg.label or f"{type(leg.strategy).__name__}/{leg.instrument.symbol}"
            trades_by_leg[key] = runner._closed
        return PortfolioResult(state=self.state, trades_by_leg=trades_by_leg)
