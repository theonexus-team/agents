# Kalshi KXBTC15M trading bot

Standalone Python service that trades Kalshi's 15-minute BTC binary markets. Fully
separate from `backtest/` (own venv), but writes into the same production Neon
Postgres via raw `psycopg`, same pattern as `backtest/engine/db.py`.

Full design/rationale: `C:\Users\tobia\.claude\plans\floating-snacking-parasol.md`.

## Strategy

Adapted 1-min ORB + VWAP (`signals/orb15.py`) generates a directional bias on BTC spot
price near the start of each 15-minute window. `execution/manager.py` buys the
near-the-money `KXBTC15M` contract in that direction, then actively manages a
target/stop **on the contract's own price** (not on BTC price) with a forced flatten
before the window settles — no position is ever held to $0/$1 settlement.

## Setup

```bash
cd kalshi-trader
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:
- Generate an API key pair in your Kalshi account (Account & security → API Keys),
  starting with a **demo** account key. Save the downloaded private key file somewhere
  outside the repo (or in `kalshi-trader/`, which `.gitignore`s `*.pem`/`*.key`).
- Set `KALSHI_KEY_ID` and `KALSHI_PRIVATE_KEY_PATH` to that key.
- Leave `KALSHI_ENV=demo` until the smoke test and a multi-day dry run both pass.

## Run order

1. `python scripts/smoke_test_demo.py` — auth, market discovery, one order placed and
   cancelled against Kalshi's demo (fake-money) environment. Run this first, and again
   after any change to `kalshi_client/`.
2. `python main.py` — runs the full bot: BTC feed → signal → execution → risk poll loop,
   against whatever `KALSHI_ENV` is set to. Logs to `logs/kalshi-trader.log`.

Only flip `KALSHI_ENV=prod` (with a separate prod API key) after a multi-day continuous
run against demo looks right — see the plan doc's verification section for the full
first-production-trade checklist.

## Risk limits

Enforced from `KalshiEngineState` in Postgres (editable live from the dashboard's
`/kalshi` page, desk-key gated): stake per trade, max daily loss, max trades/day, and a
pause/kill-switch flag the bot polls every few seconds (`KALSHI_RISK_POLL_SECONDS`).
Daily counters are recomputed from `KalshiTrade` rows on every check, not held in
memory, so a crash/restart doesn't reset them.

## Known limitations (v1)

- BTC spot feed (Coinbase public WS) is for signal generation only — Kalshi settles
  against a 60-second average of the CF Benchmarks BTC Real-Time Index, a different
  source. Basis risk between the two is inherent and not eliminated here.
- Single position at a time.
- No WebSocket order/fill push — fills and exit prices are confirmed via REST polling.
- Order-block bounce override from the futures strategy was dropped (documented scope
  cut, not an oversight).
