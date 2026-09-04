"""Port of src/lib/stats.ts computeStats, for CLI stdout summaries. The dashboard
itself reuses the real TypeScript computeStats() directly on BacktestTrade rows (see
plan) — this Python copy exists only so `cli.py backtest` can print a useful summary
without a DB round-trip."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TradeStats:
    closed_trades: int
    win_rate: float
    net_profit: float
    profit_per_dollar_risked: float
    worst_losing_stretch: float


def compute_stats(nets: list[float], per_dollar_risked: list[float]) -> TradeStats:
    if not nets:
        return TradeStats(0, 0.0, 0.0, 0.0, 0.0)

    wins = sum(1 for n in nets if n > 0)
    net_profit = sum(nets)
    avg_per_dollar_risked = sum(per_dollar_risked) / len(per_dollar_risked)

    worst_stretch = 0.0
    running = 0.0
    for n in nets:
        if n < 0:
            running += n
            worst_stretch = min(worst_stretch, running)
        else:
            running = 0.0

    return TradeStats(
        closed_trades=len(nets),
        win_rate=wins / len(nets),
        net_profit=net_profit,
        profit_per_dollar_risked=avg_per_dollar_risked,
        worst_losing_stretch=worst_stretch,
    )
