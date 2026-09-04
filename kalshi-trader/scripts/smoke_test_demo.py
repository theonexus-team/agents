"""Run this first, before anything else, once KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH
are set in .env with KALSHI_ENV=demo. Verifies auth signing, market discovery, and a
full order round-trip against Kalshi's demo (fake-money) environment. Run from the
kalshi-trader/ directory: python scripts/smoke_test_demo.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
from kalshi_client import rest


def main() -> None:
    if config.KALSHI_ENV != "demo":
        print(f"KALSHI_ENV is '{config.KALSHI_ENV}', refusing to run smoke test outside 'demo'.")
        sys.exit(1)

    print(f"Base URL: {config.BASE_URL}")

    print("\n1. Checking balance (auth signing)...")
    balance_cents = rest.get_balance()
    print(f"   Balance: ${balance_cents / 100:.2f}")

    print(f"\n2. Listing open {config.SERIES_TICKER} markets...")
    markets = rest.list_open_markets()
    print(f"   Found {len(markets)} open markets")
    if not markets:
        print("   No open KXBTC15M markets right now - try again closer to a :00/:15/:30/:45 mark.")
        sys.exit(0)
    market = markets[0]
    print(f"   Using: {market['ticker']} (yes_bid={market['yes_bid_dollars']}, yes_ask={market['yes_ask_dollars']})")

    print("\n3. Placing a resting limit order far from market (should not fill)...")
    order = rest.create_order(
        ticker=market["ticker"],
        side="bid",
        count=1,
        price_dollars="0.0100",
        time_in_force="good_till_canceled",
    )
    order_id = order["order_id"]
    print(f"   Order placed: {order_id}")

    time.sleep(1)
    print("\n4. Cancelling the order...")
    rest.cancel_order(order_id)
    print("   Cancelled.")

    print("\nSmoke test passed.")


if __name__ == "__main__":
    main()
