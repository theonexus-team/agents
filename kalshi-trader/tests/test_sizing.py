import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from execution.sizing import (
    MIN_STAKE_USD,
    contract_count,
    min_profitable_target,
    real_cost_basis,
    scaled_stake_usd,
    taker_fee,
)


def test_real_cost_basis_long_is_just_the_price():
    assert real_cost_basis(0.33, "bid") == 0.33


def test_real_cost_basis_short_is_the_complement():
    # Reproduces a real 2026-08-23 bug: sizing a short at its own price (0.33)
    # instead of its real risk (1 - 0.33 = 0.67) more than doubled real exposure
    # on an 829-contract trade ($273.57 intended vs $555.43 actual risk).
    assert real_cost_basis(0.33, "ask") == pytest.approx(0.67)
    intended_stake = 273.57
    count_using_bug = contract_count(intended_stake, 0.33)
    count_using_fix = contract_count(intended_stake, real_cost_basis(0.33, "ask"))
    assert count_using_fix < count_using_bug
    assert count_using_fix * 0.67 == pytest.approx(intended_stake, abs=1.0)


def test_contract_count_floors_and_floors_to_one():
    assert contract_count(12.50, 0.45) == 27
    assert contract_count(1.00, 0.99) == 1  # floors to 0 otherwise, min 1


def test_taker_fee_peaks_near_fifty_cents():
    assert taker_fee(10, 0.50) > taker_fee(10, 0.05)
    assert taker_fee(10, 0.50) > taker_fee(10, 0.95)


def test_min_profitable_target_clears_fees_for_a_long():
    entry = 0.45
    count = 27
    target = min_profitable_target(entry, count, direction_sign=1, min_net_usd=0.10)
    assert target > entry
    entry_fee = taker_fee(count, entry)
    net = (target - entry) * count - entry_fee - taker_fee(count, target)
    assert net >= 0.10 - 1e-9


def test_min_profitable_target_clears_fees_for_a_short():
    entry = 0.55
    count = 22
    target = min_profitable_target(entry, count, direction_sign=-1, min_net_usd=0.10)
    assert target < entry
    entry_fee = taker_fee(count, entry)
    net = -(target - entry) * count - entry_fee - taker_fee(count, target)
    assert net >= 0.10 - 1e-9


def test_min_profitable_target_is_closer_than_a_fixed_twenty_cent_target():
    # The whole point of switching off a fixed-distance target: a small, fast,
    # fee-clearing exit should usually be reachable well before a 20c move.
    entry = 0.30
    count = 41
    target = min_profitable_target(entry, count, direction_sign=1, min_net_usd=0.10)
    assert target - entry < 0.20


def test_scaled_stake_grows_with_cumulative_profit():
    base = scaled_stake_usd(starting_balance=10, base_stake=12.5, cumulative_net=0)
    assert base == 12.5  # no P&L yet -> exactly the base stake
    grown = scaled_stake_usd(starting_balance=10, base_stake=12.5, cumulative_net=10)
    # Equity doubled (10 -> 20), so the stake should double too - proportional, not additive.
    assert grown == 25.0


def test_min_profitable_target_never_demands_more_than_reachable():
    # Reproduces a real 2026-08-23 bug: a 294-contract position's 50%-of-stake
    # target ($104.37) exceeded the theoretical max net even at $0.99 ($77.87),
    # so it silently became "wait for near-certainty" and never fired before
    # forced-flatten despite touching $0.925+ along the way.
    entry, count = 0.71, 294
    impossible_min_net = 104.37
    target = min_profitable_target(entry, count, direction_sign=1, min_net_usd=impossible_min_net)
    assert target < 0.99  # must NOT collapse to the literal ceiling
    net_at_target = (target - entry) * count - taker_fee(count, entry) - taker_fee(count, target)
    assert net_at_target > 0  # still a real, reachable profit requirement


def test_scaled_stake_shrinks_with_losses_but_floors_at_minimum():
    shrunk = scaled_stake_usd(starting_balance=10, base_stake=12.5, cumulative_net=-5)
    assert shrunk == 6.25  # equity halved -> stake halved
    wiped_out = scaled_stake_usd(starting_balance=10, base_stake=12.5, cumulative_net=-9.99)
    assert wiped_out == MIN_STAKE_USD  # near-zero equity floors at $1, never hits $0 or negative
