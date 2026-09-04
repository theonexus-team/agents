"""Runs a multi-strategy PortfolioRun from a JSON config and writes it to Postgres
(production Neon by default, same as cli.py backtest --write-db). Unlike cli.py's
single-strategy `backtest` command, a portfolio inherently needs several legs at
once, so it takes a config file instead of flat CLI flags.

Usage:
    python run_portfolio.py --config portfolios/funded_mnq_hg.json

Config shape:
{
  "label": "Funded phase: turtle_soup+orb_vwap/MNQ + optimal_trade_entry/HG",
  "starting_balance": 150000,
  "max_loss_from_peak": 2000,
  "sizing_mode": "dynamic",           // "fixed" | "dynamic" -- see engine/portfolio.py
  "from": "2026-07-28",
  "to": "2026-08-21",
  "source_note": "optional free text",
  "legs": [
    {"strategy": "turtle_soup", "symbol": "MNQ", "params": {...}},
    {"strategy": "optimal_trade_entry", "symbol": "HG", "params": {...}},
    {"strategy": "orb_vwap", "symbol": "MNQ", "params": {...}}
  ]
}

Each leg's own params dict is used as-is (no default-file fallback like the
dashboard "Run" button has, since a portfolio config IS the explicit, saved
record of what ran — write out full params per leg, not just overrides).
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from cli import INSTRUMENTS
from engine.bars_store import read_bars
from engine.db import get_conn, write_portfolio_run
from engine.portfolio import PortfolioLeg, PortfolioRunner
from strategies import STRATEGIES


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a multi-strategy portfolio scenario")
    parser.add_argument("--config", required=True)
    parser.add_argument("--write-db", action="store_true", default=True)
    parser.add_argument("--no-write-db", dest="write_db", action="store_false")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text())
    start = datetime.fromisoformat(config["from"]).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(config["to"]).replace(tzinfo=timezone.utc)
    sizing_mode = config.get("sizing_mode", "dynamic")

    legs: list[PortfolioLeg] = []
    leg_specs = []  # (strategy_name, instrument, params) for the eventual DB write
    for leg_cfg in config["legs"]:
        strategy_name = leg_cfg["strategy"]
        symbol = leg_cfg["symbol"]
        params = dict(leg_cfg.get("params", {}))
        if sizing_mode == "fixed":
            params.setdefault("sizing_mode", "fixed")

        instrument = INSTRUMENTS[symbol]
        bars = read_bars(symbol, "1m", start, end)
        strategy = STRATEGIES[strategy_name](params, instrument)
        label = f"{strategy_name}/{symbol}"
        legs.append(PortfolioLeg(strategy, instrument, bars, label=label))
        leg_specs.append((strategy_name, instrument, params))

    runner = PortfolioRunner(
        legs,
        starting_balance=config["starting_balance"],
        max_loss_from_peak=config.get("max_loss_from_peak", 2000),
    )
    result = runner.run()

    print(f"Portfolio: {config['label']}")
    print(f"  Legs: {', '.join(leg.label for leg in legs)}")
    print(f"  Total net: ${result.total_net:,.2f}")
    print(f"  Max drawdown: ${result.state.max_drawdown_seen:,.2f}")
    print(f"  Final equity: ${result.state.equity:,.2f}")
    for label, trades in result.trades_by_leg.items():
        print(f"    {label}: {len(trades)} trades")

    if args.write_db:
        conn = get_conn()
        try:
            legs_for_db = [
                (strategy_name, instrument, result.trades_by_leg[f"{strategy_name}/{instrument.symbol}"], params)
                for strategy_name, instrument, params in leg_specs
            ]
            portfolio_id = write_portfolio_run(
                conn,
                label=config["label"],
                starting_balance=config["starting_balance"],
                max_loss_from_peak=config.get("max_loss_from_peak", 2000),
                sizing_mode=sizing_mode,
                legs=legs_for_db,
                timeframe="1m",
                mode="HISTORICAL",
                data_start=start,
                data_end=end,
                source_note=config.get("source_note"),
            )
        finally:
            conn.close()
        print(f"  Wrote PortfolioRun {portfolio_id} to Postgres.")


if __name__ == "__main__":
    main()
