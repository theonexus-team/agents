from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import config
import db.db as db
from execution.position import KalshiPosition, PositionStatus
from execution.sizing import contract_count, min_profitable_target, real_cost_basis, stake_from_equity, taker_fee
from kalshi_client import rest
from market.ticker import get_current_market
from signals.types import Direction, Signal

logger = logging.getLogger("kalshi_trader.execution")

POLL_INTERVAL_SECONDS = 2
FILL_TIMEOUT_SECONDS = 15


class ExecutionManager:
    def __init__(self) -> None:
        self._position: Optional[KalshiPosition] = None

    @property
    def has_open_position(self) -> bool:
        return self._position is not None

    def recover_on_startup(self) -> None:
        recovered = db.recover_open_position(config.PAPER_MODE)
        if recovered is not None:
            self._position = recovered
            logger.warning(
                "Recovered orphaned open position from a prior run: %s %s @ %.4f x%s (target %.4f)",
                recovered.entry_side, recovered.ticker, recovered.entry_price, recovered.contracts, recovered.target_price,
            )

    async def handle_signal(self, signal: Signal, btc_spot_price: float) -> None:
        if self._position is not None:
            logger.info("Signal %s ignored: a position is already open", signal.direction)
            return

        market = get_current_market(config.SERIES_TICKER)
        if market is None:
            logger.warning("No open %s market found for signal %s", config.SERIES_TICKER, signal.direction)
            db.write_signal(signal, fired=False, blocked_reason="no_open_market")
            return

        # floor_strike/strike_type: greater_or_equal -> YES = up, matching Direction.LONG.
        entry_side = "bid" if signal.direction is Direction.LONG else "ask"
        price = float(market["yes_ask_dollars"] if entry_side == "bid" else market["yes_bid_dollars"])

        if not (config.MIN_ENTRY_PRICE <= price <= config.MAX_ENTRY_PRICE):
            logger.info("Entry price %.4f outside tradeable band, skipping", price)
            db.write_signal(signal, fired=False, blocked_reason="price_out_of_band")
            return

        state = db.read_engine_state()
        if config.PAPER_MODE:
            cumulative_net = db.cumulative_net_pnl(is_paper=True)
            equity = state["startingBalance"] + cumulative_net
        else:
            # Real money: ask Kalshi for the actual live balance rather than
            # bookkeeping it ourselves - a manual deposit/withdrawal outside the
            # bot (e.g. pulling out half of daily winnings) is invisible to any
            # startingBalance+cumulative_net formula, so that number would silently
            # drift from reality. Querying live balance means it's always correct
            # with zero extra steps, no manual "resync" ever needed.
            equity = rest.get_balance() / 100
        stake = stake_from_equity(state["startingBalance"], state["stakePerTrade"], equity)
        count = contract_count(stake, real_cost_basis(price, entry_side))
        logger.info("Sizing: equity=%.2f stake=%.2f (base=%.2f, starting=%.2f)", equity, stake, state["stakePerTrade"], state["startingBalance"])

        if config.PAPER_MODE:
            # Simulated fill at the observed best price - no real order placed.
            logger.info("[paper] would buy %s %s @ %.4f x%s", entry_side, market["ticker"], price, count)
        else:
            try:
                order = rest.create_order(
                    ticker=market["ticker"],
                    side=entry_side,
                    count=count,
                    price_dollars=f"{price:.4f}",
                    time_in_force="immediate_or_cancel",
                )
            except rest.KalshiApiError:
                logger.exception("Order placement failed")
                db.write_signal(signal, fired=False, blocked_reason="order_error")
                return

            filled = await self._await_fill(order["order_id"])
            if not filled:
                logger.warning("Order %s did not fill within timeout, aborting trade", order["order_id"])
                rest.cancel_order(order["order_id"])
                db.write_signal(signal, fired=False, blocked_reason="fill_timeout")
                return

        direction_sign = 1 if entry_side == "bid" else -1
        min_net_usd = stake * config.MIN_PROFIT_PCT_OF_STAKE
        target = min_profitable_target(price, count, direction_sign, min_net_usd)
        stop = price - config.STOP_MOVE if entry_side == "bid" else price + config.STOP_MOVE
        stop = max(0.01, min(0.99, round(stop, 4)))

        self._position = KalshiPosition(
            id=str(uuid.uuid4()),
            ticker=market["ticker"],
            strategy=signal.strategy,
            strike_price=float(market["floor_strike"]),
            entry_side=entry_side,
            entry_price=price,
            contracts=count,
            stop_price=stop,
            target_price=target,
            window_close_at=signal.window_close_at,
            opened_at=datetime.now(timezone.utc),
            btc_spot_at_entry=btc_spot_price,
        )
        db.write_open_trade(self._position, signal, is_paper=config.PAPER_MODE)
        db.write_signal(signal, fired=True)
        logger.info(
            "Opened %s %s @ %.4f x%s (target %.4f, stop %.4f)",
            entry_side, market["ticker"], price, count, target, stop,
        )

    async def _await_fill(self, order_id: str) -> bool:
        deadline = asyncio.get_event_loop().time() + FILL_TIMEOUT_SECONDS
        while asyncio.get_event_loop().time() < deadline:
            fills = rest.get_fills(order_id=order_id)
            if fills:
                return True
            await asyncio.sleep(1)
        return False

    async def monitor_loop(self) -> None:
        while True:
            if self._position is not None:
                await self._check_exit(self._position)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def _check_exit(self, pos: KalshiPosition) -> None:
        now = datetime.now(timezone.utc)
        market = rest.get_market(pos.ticker)
        current_price = float(market["yes_bid_dollars"] if pos.entry_side == "bid" else market["yes_ask_dollars"])

        force_deadline = pos.window_close_at.timestamp() - config.FORCE_FLATTEN_LEAD_SECONDS
        if now.timestamp() >= force_deadline:
            await self._exit(pos, PositionStatus.FORCED_FLAT, observed_price=current_price)
            return

        hit_target = (
            (pos.entry_side == "bid" and current_price >= pos.target_price)
            or (pos.entry_side == "ask" and current_price <= pos.target_price)
        )
        # No stop-loss exit (explicit user decision, 2026-08-23, after a stopped-out
        # trade reversed hard and would have been deeply profitable if held): ride
        # drawdown looking for any profitable moment, only forced out by the
        # pre-settlement flatten above if the window closes with no green window.
        # stop_price is still recorded on the position/DB row for reference, just
        # not acted on here.
        if hit_target:
            await self._exit(pos, PositionStatus.TARGET_HIT, observed_price=current_price)

    async def _exit(self, pos: KalshiPosition, outcome: PositionStatus, observed_price: float) -> None:
        if config.PAPER_MODE:
            exit_price = observed_price
            logger.info("[paper] would sell %s %s @ %.4f", pos.exit_side, pos.ticker, exit_price)
        else:
            try:
                order = rest.create_order(
                    ticker=pos.ticker,
                    side=pos.exit_side,
                    count=pos.contracts,
                    price_dollars="0.0100" if pos.exit_side == "ask" else "0.9900",  # marketable, sweeps to best available
                    time_in_force="immediate_or_cancel",
                )
                await self._await_fill(order["order_id"])
                fills = rest.get_fills(order_id=order["order_id"])
                exit_price = float(fills[0]["yes_price_dollars"]) if fills else observed_price
            except rest.KalshiApiError:
                logger.exception("Exit order failed for %s", pos.ticker)
                outcome = PositionStatus.ERROR
                exit_price = pos.entry_price

        pos.exit_price = exit_price
        pos.status = outcome
        pos.closed_at = datetime.now(timezone.utc)
        pos.fees_paid = taker_fee(pos.contracts, pos.entry_price) + taker_fee(pos.contracts, exit_price)
        db.write_trade_close(pos)
        logger.info("Closed %s %s: %s @ %.4f, net=%.2f", pos.ticker, outcome.value, pos.exit_side, exit_price, pos.net_pnl() or 0.0)
        self._position = None

    async def force_flatten_if_open(self, reason: str = "risk_kill") -> None:
        if self._position is not None:
            pos = self._position
            market = rest.get_market(pos.ticker)
            current_price = float(market["yes_bid_dollars"] if pos.entry_side == "bid" else market["yes_ask_dollars"])
            logger.warning("Force-flattening open position due to %s", reason)
            await self._exit(pos, PositionStatus.FORCED_FLAT, observed_price=current_price)
