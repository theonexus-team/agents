from __future__ import annotations

import math


MIN_STAKE_USD = 1.0


def contract_count(stake_dollars: float, price_dollars: float) -> int:
    return max(1, math.floor(stake_dollars / price_dollars))


def real_cost_basis(price_dollars: float, entry_side: str) -> float:
    """Real dollar risk per contract. For a long YES ('bid'), it's the price paid.
    For a short/NO ('ask') position, you receive `price_dollars` upfront but owe up
    to $1 if it resolves against you, so real max loss is (1 - price_dollars), not
    price_dollars. Sizing off the wrong basis silently doubles+ real exposure on
    any low-priced short (confirmed as a real bug 2026-08-23: an 829-contract short
    at $0.33 was sized as if it risked $273.57 when its real max risk was $555.43)."""
    return price_dollars if entry_side == "bid" else (1 - price_dollars)


def stake_from_equity(starting_balance: float, base_stake: float, equity: float) -> float:
    """Proportional compounding: stake stays the same fraction of equity
    (base_stake / starting_balance) regardless of how equity itself was measured,
    so wins scale future stakes up and losses scale them down - true compounding
    rather than a fixed dollar amount per trade. Floored at MIN_STAKE_USD so a
    drawdown can't shrink the stake to zero/negative."""
    fraction = base_stake / starting_balance
    return max(MIN_STAKE_USD, fraction * max(0.0, equity))


def scaled_stake_usd(starting_balance: float, base_stake: float, cumulative_net: float) -> float:
    """Paper-mode equity: a virtual bankroll tracked purely from this bot's own
    trade history (starting_balance + sum of net P&L). Fine for paper trading
    since nothing external can move the balance, but for real trading this drifts
    from the truth the moment money is deposited/withdrawn outside the bot - see
    manager.py's real-money path, which queries Kalshi's live balance instead."""
    equity = starting_balance + cumulative_net
    return stake_from_equity(starting_balance, base_stake, equity)


def taker_fee(count: int, price_dollars: float) -> float:
    """ceil(0.07 * count * price * (1-price)), rounded up to the cent - Kalshi's published
    taker fee formula. VERIFY the 0.07 coefficient against the live fee schedule
    (kalshi.com/docs/kalshi-fee-schedule.pdf) before trusting this for real target math,
    it was sourced from a secondary summary, not the primary OpenAPI spec."""
    raw = 0.07 * count * price_dollars * (1 - price_dollars)
    return math.ceil(raw * 100) / 100


#: When the requested min_net_usd can't be reached even at the $0.01/$0.99 price
#: ceiling (large compounded stakes need a bigger dollar move than the price range
#: can ever provide), cap the requirement at this fraction of the best possible
#: net instead of literally demanding the max - otherwise the target silently
#: becomes "wait for near-certainty" (effectively never fires before forced-flat),
#: which defeats the entire point of cashing out early. Confirmed as a real bug
#: 2026-08-23: a 294-contract position's 50%-of-stake target ($104.37) exceeded
#: even the theoretical max net at $0.99 ($77.87), so it rode to forced-flatten
#: with no chance of an early exit despite touching $0.925+ along the way.
UNREACHABLE_TARGET_FALLBACK_FRACTION = 0.85


def min_profitable_target(entry_price: float, count: int, direction_sign: int, min_net_usd: float) -> float:
    """Smallest price move in the profitable direction where net PnL (after both
    entry and exit taker fees) clears min_net_usd. Take-profit-fast philosophy:
    compound by cashing out as soon as a trade is genuinely profitable, rather than
    holding for a large fixed target or riding every trade to the 15-min window
    close. direction_sign: +1 for a long YES (entry_side='bid'), -1 for short/NO
    (entry_side='ask')."""
    entry_fee = taker_fee(count, entry_price)
    ceiling_price = 0.99 if direction_sign > 0 else 0.01
    max_reachable_net = direction_sign * (ceiling_price - entry_price) * count - entry_fee - taker_fee(count, ceiling_price)
    if min_net_usd > max_reachable_net:
        min_net_usd = max_reachable_net * UNREACHABLE_TARGET_FALLBACK_FRACTION

    price = entry_price
    step = 0.01
    while 0.01 < price < 0.99:
        price = round(price + direction_sign * step, 4)
        price = max(0.01, min(0.99, price))
        net = direction_sign * (price - entry_price) * count - entry_fee - taker_fee(count, price)
        if net >= min_net_usd:
            return price
        if direction_sign > 0 and price >= 0.99:
            return 0.99
        if direction_sign < 0 and price <= 0.01:
            return 0.01
    return price
