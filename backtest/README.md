# Backtest engine

Standalone Python engine for backtesting/forward-testing trading strategies. Separate
from the Next.js app — own venv, only shares the production Postgres DB (writes
`BacktestRun`/`BacktestTrade` rows there so the main dashboard reads them).

**Status: live.** Two real strategies ported (`orb_vwap`, `algo2_first_touch`),
writing to production, viewable and triggerable at
`https://theonexus-trading-oracle.vercel.app/backtests`. Forward-test state
persistence (`Strategy.serialize_state`/`restore_state`) is the one piece of the
original plan not built yet — matters once a run needs to resume incrementally
instead of always replaying from scratch.

## Setup

```
cd backtest
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Getting bar data in

Two sources:

```
# Real TradingView "Export chart data" CSV.
python cli.py ingest --symbol MGC --timeframe 1m --file data/raw_csv/your_export.csv

# Yahoo Finance's public chart API (no export needed) — same source the live
# dashboard's Price Data Health panel uses, just pulling history instead of a
# single quote. Real practical limit for 1-minute bars is ~3-4 weeks (empirically
# verified: 20 days back still returns data, 30 days back gets refused), NOT the
# 60 days sometimes claimed for it — good for a short real sanity/forward-test
# window, nowhere near enough for a real multi-year backtest.
python cli.py fetch-yahoo --symbol MGC --days 25
```

Both go through the same dedupe/partition path (`ingest/import_csv.py`,
`engine/bars_store.py`) regardless of source.

## Running a backtest

```
# Print results to stdout only.
python cli.py backtest --strategy orb_vwap --symbol MGC --timeframe 1m \
    --from 2026-07-28 --to 2026-08-21 --params strategies/params/orb_vwap_default.json

# Also write the run + every trade to Postgres (production Neon DB by default —
# see BACKTEST_DATABASE_URL in the repo-root .env — so it shows up on the live
# dashboard).
python cli.py backtest --strategy orb_vwap --symbol MGC --timeframe 1m \
    --from 2026-07-28 --to 2026-08-21 --params strategies/params/orb_vwap_default.json \
    --write-db --mode HISTORICAL --source-note "whatever this run is testing"
```

`--params` takes a JSON string or a path to a `.json` file — each strategy's tuned
defaults live in `strategies/params/<name>_default.json`.

## Running from the dashboard instead

`/backtests` has a "Run a new backtest" form (desk-key-gated). Submitting it writes
a `BacktestRun` row with `status='queued'` — it does NOT run instantly, because the
engine only runs on this machine, not on Vercel. The `theonexus-backtest-worker`
scheduled task polls every 10 minutes (`python worker.py`), executes anything
queued, and flips it to `completed` (with real trades) or `failed` (with a reason in
`sourceNote`). Run `python worker.py` manually if you don't want to wait for the
next scheduled pass.

## Adding a new strategy

1. **Write it**: create `strategies/<name>.py`, subclass `engine.strategy.Strategy`.
   Look at `strategies/smoke_test.py` for the minimal shape (session windows +
   `on_bar`), or `strategies/orb_vwap.py` / `strategies/algo2_first_touch.py` for a
   full worked example including the shared order-block tracker
   (`engine.orderblocks.OrderBlockTracker` — reuse this for any zone/order-block
   strategy rather than re-deriving swing-high/low detection from scratch) and the
   engine's generic trailing-stop/force-flat mechanism (`params["trail_arm_profit"]`
   / `params["trail_ticks"]` / `params["force_flat_minutes"]` — set these and the
   runner handles them automatically; you don't reimplement them in `on_bar`).

2. **Register it**: add the class to `STRATEGIES` in `strategies/__init__.py`. It's
   now usable from the CLI immediately.

3. **Give it defaults**: add `strategies/params/<name>_default.json`. Both the CLI
   (when `--params` is omitted... actually always required today, but worth having
   the file as the canonical reference) and the dashboard worker fall back to this
   file when a run arrives with no parameters, so results stay reproducible even
   when queued from the "Run new backtest" form, which doesn't expose per-parameter
   overrides.

4. **Test it via CLI first**, on whatever bars are already ingested, before trusting
   it in the dashboard — see "Running a backtest" above.

5. **Wire it into the dashboard** — there's no shared source of truth between Python
   and the Next.js app, so two frontend lists need the new name added by hand:
   - `src/components/RunBacktestForm.tsx`'s `STRATEGIES` array (the dropdown)
   - `src/app/api/backtests/run/route.ts`'s `VALID_STRATEGIES` array (server-side
     validation — the queue endpoint rejects anything not in this list)

   Then `npm run build` to make sure nothing broke, and redeploy.

That's it — no dashboard code changes beyond step 5's two lists. A new strategy
shows up in the run list/detail pages automatically once it has any completed runs,
since those pages just read whatever's in `BacktestRun`/`BacktestTrade`.

If the new strategy is a faithful port of an existing Pine script (as opposed to
something built from scratch off a YouTube video or someone else's rules), read the
Pine source fully first and be explicit in code comments about any place the Python
version makes a judgment call the Pine script doesn't literally spell out (session
timezone handling, exact execution ordering within a bar, etc.) — `orb_vwap.py`'s
docstring is a template for what that documentation should look like.

## Known limitation — TradingView CSV format is unverified

`ingest/import_csv.py`'s parser has not been checked against a real TradingView
export (none was available while this was built). It auto-detects Unix-epoch-seconds
vs. an ISO-ish date string for the `time` column and assumes UTC. **Export one real
CSV and ingest it before trusting results built from real TradingView data** — if
the parser guesses wrong you'll likely get an obviously-wrong bar count or date
range printed by `cli.py ingest`, not a silent corruption, but verify anyway. (The
Yahoo Finance path above doesn't have this problem — it's a different, tested code
path for the CSV shape itself, just fed from a different source.)

## Known limitation — no news-event filtering

None of the backtest results in this project account for economic news releases
(FOMC, CPI, NFP, etc.) — every trade in every result is unfiltered, including
whatever high-impact moves happened to land inside the tested window. This matters
most for MGC (gold), one of the most news-reactive instruments there is; some of its
strategy P&L could be attributable to news volatility rather than the strategy's
actual technical edge, in either direction.

This is a real gap, not a rounding error, and it's unresolved — not a design
choice. What's blocking it: the live dashboard already has an economic-calendar
integration (`src/lib/providers/apify-forexfactory.ts`, via the Apify actor
`scrapemint/forexfactory-economic-calendar`), but it only ever requests
`range: "this_week"` (a rolling, forward-looking window with no history retained —
`EconomicEvent` rows get wiped and replaced on every sync). Getting the actual
*historical* calendar for a specific past window requires the actor's
`range: "custom"` mode, which reads ForexFactory's real calendar page (not its fast
JSON feed) and gets 403-blocked from Apify's datacenter IPs intermittently — retrying
sometimes works, but reliably getting through requires paying extra for a
residential proxy (`proxyConfiguration.apifyProxyGroups: ["RESIDENTIAL"]`). A
`backtest/ingest/fetch_econ_calendar.py` script exists with the retry logic already
built (see its docstring), but the residential-proxy option was deliberately not
spent on — this was intentionally deprioritized rather than actually solved. If you
want this fixed: either pay for the proxy run once and wire the resulting event
timestamps into a trade-blackout filter (skip/tag any trade opened within the same
window the live dashboard's stated policy already describes — 1 minute before/after
a high-impact release), or supply the known major news dates/times for a given
window directly and skip the scraping problem entirely.

## Fill assumptions

If one bar's [low, high] range contains both a position's stop and target, OHLC data
alone can't say which was hit first (same ambiguity Pine's own backtester has). Default
is `--fill-tie-break stop_first` (pessimistic) — override with `target_first` to see the
optimistic bound. Whichever was used is recorded in `BacktestRun.parameters`.
