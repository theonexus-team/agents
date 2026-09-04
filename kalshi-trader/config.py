from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent
load_dotenv(_HERE.parent / ".env")
# No override: an empty/unset key in this .env (e.g. BACKTEST_DATABASE_URL, meant to
# inherit from the repo-root .env) must not clobber a real value already loaded above.
load_dotenv(_HERE / ".env")

KALSHI_ENV = os.environ.get("KALSHI_ENV", "demo")
KALSHI_KEY_ID = os.environ.get("KALSHI_KEY_ID", "")
KALSHI_PRIVATE_KEY_PATH = os.environ.get("KALSHI_PRIVATE_KEY_PATH", "")

# Independent of KALSHI_ENV: paper mode reads real live market data (still needs a
# valid API key, since market discovery/quotes go through the same authenticated
# client) but simulates fills instead of ever calling create_order. Defaults to
# true - going live for real requires explicitly setting this to false.
PAPER_MODE = os.environ.get("KALSHI_PAPER_MODE", "true").lower() == "true"

BASE_URLS = {
    "demo": "https://external-api.demo.kalshi.co/trade-api/v2",
    "prod": "https://external-api.kalshi.com/trade-api/v2",
}
BASE_URL = BASE_URLS[KALSHI_ENV]

SERIES_TICKER = "KXBTC15M"

STAKE_PER_TRADE_USD = float(os.environ.get("KALSHI_STAKE_PER_TRADE_USD", "12.50"))
MAX_DAILY_LOSS_USD = float(os.environ.get("KALSHI_MAX_DAILY_LOSS_USD", "50"))
MAX_TRADES_PER_DAY = int(os.environ.get("KALSHI_MAX_TRADES_PER_DAY", "5"))
RISK_POLL_SECONDS = float(os.environ.get("KALSHI_RISK_POLL_SECONDS", "4"))

# Take-profit-fast / compounding philosophy: exit as soon as a trade clears this
# % of its own stake in net profit (after round-trip fees), not a fixed price-
# distance target or a flat dollar amount - scales automatically as the stake
# compounds up instead of staying stuck at a fixed dollar figure forever.
MIN_PROFIT_PCT_OF_STAKE = float(os.environ.get("KALSHI_MIN_PROFIT_PCT", "0.50"))
STOP_MOVE = int(os.environ.get("KALSHI_STOP_CENTS", "20")) / 100
FORCE_FLATTEN_LEAD_SECONDS = int(os.environ.get("KALSHI_FORCE_FLATTEN_LEAD_SECONDS", "75"))

MIN_ENTRY_PRICE = 0.15
MAX_ENTRY_PRICE = 0.85

BREAKOUT_WINDOW_MINUTES = 6
ROLLING_VWAP_MINUTES = 90

YAHOO_CHECK_INTERVAL_SECONDS = 60
YAHOO_DIVERGENCE_WARN_USD = 50.0
