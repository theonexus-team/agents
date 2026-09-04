"""Backtest engine CLI. Run from inside backtest/ with its venv active:

    python cli.py ingest --symbol MGC --timeframe 1m --file data/raw_csv/MGC_sample.csv
    python cli.py backtest --strategy smoke_test --symbol MGC --timeframe 1m \
        --from 2024-01-01 --to 2024-03-01 --params '{"target_ticks":10,"stop_ticks":10}'
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from engine.bar import InstrumentSpec
from engine.bars_store import coverage, read_bars
from engine.db import get_conn, write_run
from engine.runner import BacktestRunner
from engine.stats import compute_stats
from engine.strategy import FillTieBreak
from ingest.fetch_yahoo import fetch_yahoo_csv
from ingest.import_csv import ingest_csv
from strategies import STRATEGIES

#: Real CME/COMEX tick specs. MGC/HG/MNQ match prisma Instrument seed data (already
#: live-traded). MYM/M2K/MCL/SIL added 2026-09-04 for the Instrument Scout (see
#: scout.py) — NOT onboarded to the live webhook/Prisma schema, backtest-only until
#: real trades justify adding them there too. Specs verified against CME's own specs
#: (tick_value = tick_size * contract multiplier checks out on all four):
#:   MYM (Micro Dow):        1.00 pt tick = $0.50
#:   M2K (Micro Russell 2K): 0.10 pt tick = $0.50
#:   MCL (Micro Crude Oil):  $0.01/bbl tick = $1.00 (100 bbl contract)
#:   SIL (Micro Silver):     $0.005/oz tick = $5.00 (1,000 oz contract)
INSTRUMENTS = {
    "MGC": InstrumentSpec(symbol="MGC", tick_size=0.10, tick_value=1.00),
    "HG": InstrumentSpec(symbol="HG", tick_size=0.0005, tick_value=12.50),
    "MNQ": InstrumentSpec(symbol="MNQ", tick_size=0.25, tick_value=0.50),
    "MYM": InstrumentSpec(symbol="MYM", tick_size=1.00, tick_value=0.50),
    "M2K": InstrumentSpec(symbol="M2K", tick_size=0.10, tick_value=0.50),
    "MCL": InstrumentSpec(symbol="MCL", tick_size=0.01, tick_value=1.00),
    "SIL": InstrumentSpec(symbol="SIL", tick_size=0.005, tick_value=5.00),
}


def _parse_date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def _load_params(raw: str) -> dict:
    path = Path(raw)
    if path.exists():
        return json.loads(path.read_text())
    return json.loads(raw)


def cmd_ingest(args: argparse.Namespace) -> None:
    result = ingest_csv(Path(args.file), args.symbol, args.timeframe)
    if result.skipped:
        print(f"Skipped: {result.reason}")
        return
    print(
        f"Ingested {result.rows_ingested} bar(s) for {args.symbol}/{args.timeframe} "
        f"spanning {result.min_ts} -> {result.max_ts}. "
        f"{result.duplicates_skipped} duplicate timestamp(s) resolved against the existing store."
    )


def cmd_fetch_yahoo(args: argparse.Namespace) -> None:
    csv_path = fetch_yahoo_csv(args.symbol, args.timeframe, days=args.days)
    result = ingest_csv(csv_path, args.symbol, args.timeframe)
    if result.skipped:
        print(f"Fetched {csv_path.name} but skipped ingest: {result.reason}")
        return
    print(
        f"Fetched + ingested {result.rows_ingested} bar(s) for {args.symbol}/{args.timeframe} from Yahoo Finance, "
        f"spanning {result.min_ts} -> {result.max_ts}."
    )


def cmd_backtest(args: argparse.Namespace) -> None:
    if args.strategy not in STRATEGIES:
        print(f"Unknown strategy '{args.strategy}'. Available: {', '.join(STRATEGIES)}", file=sys.stderr)
        sys.exit(1)
    if args.symbol not in INSTRUMENTS:
        print(f"Unknown symbol '{args.symbol}'. Available: {', '.join(INSTRUMENTS)}", file=sys.stderr)
        sys.exit(1)

    instrument = INSTRUMENTS[args.symbol]
    params = _load_params(args.params) if args.params else {}
    start, end = _parse_date(args.date_from), _parse_date(args.date_to)

    cov = coverage(args.symbol, args.timeframe)
    if cov is None:
        print(
            f"No bars ingested yet for {args.symbol}/{args.timeframe}. "
            f"Run `python cli.py ingest` first.",
            file=sys.stderr,
        )
        sys.exit(1)

    bars = read_bars(args.symbol, args.timeframe, start, end)
    if not bars:
        print(
            f"No bars found for {args.symbol}/{args.timeframe} in [{args.date_from}, {args.date_to}]. "
            f"Ingested coverage is {cov[0]} -> {cov[1]} ({cov[2]} bars total).",
            file=sys.stderr,
        )
        sys.exit(1)

    strategy_cls = STRATEGIES[args.strategy]
    strategy = strategy_cls(params, instrument)
    tie_break = FillTieBreak.TARGET_FIRST if args.fill_tie_break == "target_first" else FillTieBreak.STOP_FIRST
    runner = BacktestRunner(strategy, instrument, fill_tie_break=tie_break)
    trades = runner.run(bars)

    nets, per_dollar = [], []
    if args.write_db:
        params_with_meta = {**params, "fill_tie_break": tie_break.value}
        conn = get_conn()
        try:
            run_id = write_run(
                conn,
                strategy=args.strategy,
                instrument=instrument,
                timeframe=args.timeframe,
                mode=args.mode,
                trades=trades,
                parameters=params_with_meta,
                source_note=args.source_note,
                starting_balance=args.starting_balance,
                data_start=start,
                data_end=end,
            )
        finally:
            conn.close()
        print(f"Wrote BacktestRun {run_id} with {len(trades)} trade(s) to Postgres.")

    # Recompute net/perDollarRisked locally too, purely for the stdout summary (no
    # extra DB round-trip needed just to print a result).
    from engine.pnl import compute_close_pnl

    for t in trades:
        pnl = compute_close_pnl(
            direction=t.direction.value,
            entry_price=t.entry_price,
            stop_price=t.initial_stop_price,
            exit_price=t.exit_price,
            contracts=t.contracts,
            tick_value=instrument.tick_value,
            tick_size=instrument.tick_size,
            risk_per_trade=params.get("risk_per_trade", 150.0),
        )
        nets.append(pnl.net)
        per_dollar.append(pnl.per_dollar_risked)

    stats = compute_stats(nets, per_dollar)
    print(f"Strategy: {args.strategy} | {args.symbol} {args.timeframe} | {args.date_from} -> {args.date_to} | mode={args.mode}")
    print(f"Bars processed: {len(bars)}")
    print(f"Trades closed: {stats.closed_trades}")
    print(f"Win rate: {stats.win_rate * 100:.1f}%")
    print(f"Net: ${stats.net_profit:.2f}")
    print(f"Worst losing stretch: ${stats.worst_losing_stretch:.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Theonexus backtest engine")
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="Import a TradingView CSV export into the local bar store")
    p_ingest.add_argument("--symbol", required=True, choices=list(INSTRUMENTS))
    p_ingest.add_argument("--timeframe", required=True, help='e.g. "1m"')
    p_ingest.add_argument("--file", required=True)
    p_ingest.set_defaults(func=cmd_ingest)

    p_yahoo = sub.add_parser(
        "fetch-yahoo", help="Pull recent bars from Yahoo Finance and ingest them (lookback varies by timeframe)"
    )
    p_yahoo.add_argument("--symbol", required=True, choices=list(INSTRUMENTS))
    p_yahoo.add_argument("--timeframe", default="1m", choices=["1m", "5m", "15m", "30m", "1h"])
    p_yahoo.add_argument("--days", type=int, default=None, help="Defaults to the per-timeframe max if omitted")
    p_yahoo.set_defaults(func=cmd_fetch_yahoo)

    p_backtest = sub.add_parser("backtest", help="Run a strategy over ingested bars")
    p_backtest.add_argument("--strategy", required=True, choices=list(STRATEGIES))
    p_backtest.add_argument("--symbol", required=True, choices=list(INSTRUMENTS))
    p_backtest.add_argument("--timeframe", required=True)
    p_backtest.add_argument("--from", dest="date_from", required=True, help="YYYY-MM-DD")
    p_backtest.add_argument("--to", dest="date_to", required=True, help="YYYY-MM-DD")
    p_backtest.add_argument("--params", default=None, help="JSON string or path to a .json file")
    p_backtest.add_argument("--fill-tie-break", choices=["stop_first", "target_first"], default="stop_first")
    p_backtest.add_argument("--write-db", action="store_true")
    p_backtest.add_argument("--mode", choices=["HISTORICAL", "FORWARD"], default="HISTORICAL")
    p_backtest.add_argument("--source-note", default=None)
    p_backtest.add_argument("--starting-balance", type=float, default=50000.0)
    p_backtest.set_defaults(func=cmd_backtest)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
