from __future__ import annotations

import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import config
import db.db as db
from execution.manager import ExecutionManager
from feed.bar_aggregator import BarAggregator
from feed.btc_spot import btc_ticks
from feed.yahoo_check import fetch_btc_price_yahoo
from risk.limits import can_open_new_trade, enforce_kill_switch_after_close
from risk.state import poll_loop
from signals.algo2_15 import Algo2Signal
from signals.orb15 import Orb15VwapSignal

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(LOG_DIR / "kalshi-trader.log", maxBytes=10_000_000, backupCount=5),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("kalshi_trader.main")


class _CoinbasePrice:
    """Shared mutable holder so the Yahoo cross-check loop can see the signal
    loop's latest Coinbase price without the two loops being coupled directly."""

    value: float | None = None


async def yahoo_cross_check_loop(price_holder: _CoinbasePrice) -> None:
    """Independent data source (Yahoo Finance, same one the backtest engine already
    uses) polled on its own slow cadence purely to catch basis risk - a Coinbase-
    specific move the rest of the market didn't share, or a feed bug - not used to
    drive any trading decision itself."""
    while True:
        await asyncio.sleep(config.YAHOO_CHECK_INTERVAL_SECONDS)
        yahoo_price = fetch_btc_price_yahoo()
        coinbase_price = price_holder.value
        if yahoo_price is None or coinbase_price is None:
            continue
        divergence = abs(yahoo_price - coinbase_price)
        if divergence >= config.YAHOO_DIVERGENCE_WARN_USD:
            logger.warning(
                "BTC price divergence: Coinbase=%.2f Yahoo=%.2f (diff=%.2f) - possible basis risk / feed issue",
                coinbase_price, yahoo_price, divergence,
            )
        else:
            logger.info("BTC price cross-check ok: Coinbase=%.2f Yahoo=%.2f (diff=%.2f)", coinbase_price, yahoo_price, divergence)


async def signal_loop(manager: ExecutionManager, price_holder: _CoinbasePrice) -> None:
    aggregator = BarAggregator()
    signal_generators = [Orb15VwapSignal(), Algo2Signal()]
    last_price = None

    async for ts, price, size in btc_ticks():
        last_price = price
        price_holder.value = price
        bar = aggregator.add_tick(ts, price, size)
        if bar is None:
            continue
        # Both strategies see every bar. If both fire on the same bar, whichever is
        # handled first wins - handle_signal() already refuses a second entry while
        # a position is open, so the other is simply logged as blocked, not lost.
        for gen in signal_generators:
            sig = gen.on_bar(bar)
            if sig is None:
                continue
            allowed, reason = can_open_new_trade()
            if not allowed:
                logger.info("Signal %s (%s) blocked: %s", sig.direction, sig.strategy, reason)
                db.write_signal(sig, fired=False, blocked_reason=reason)
                continue
            await manager.handle_signal(sig, last_price)
            enforce_kill_switch_after_close()


async def main() -> None:
    logger.info("Starting Kalshi trader, env=%s", config.KALSHI_ENV)
    manager = ExecutionManager()
    manager.recover_on_startup()
    price_holder = _CoinbasePrice()
    await asyncio.gather(
        signal_loop(manager, price_holder),
        manager.monitor_loop(),
        poll_loop(manager),
        yahoo_cross_check_loop(price_holder),
    )


if __name__ == "__main__":
    while True:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            break
        except Exception:
            logger.exception("main() crashed, restarting in 10s")
            import time
            time.sleep(10)
