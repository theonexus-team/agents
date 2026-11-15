# UT Bot Dashboard

TradingView UT Bot signals (16 symbols, 2m, NY session) → webhook → paper trading + phone push.
Full spec: [SPEC.md](SPEC.md) (text export of the build spec PDF).

**Status: setup mode.** The app runs on sample data. No outside service is called yet.
Open **/setup** (the "Accounts" tab) for each account to sign in to and the values to collect.

## Run locally

```bash
cd ut-bot-dashboard
npm install --legacy-peer-deps
cp .env.example .env.local   # fill DASHBOARD_PASSWORD, AUTH_SECRET, WEBHOOK_SECRET at minimum
npm run dev                  # http://localhost:3000
npm test                     # session + nakshatra unit tests
npm run send-test-signal     # posts a sample UT payload to the local webhook (needs WEBHOOK_SECRET in env)
```

## What's built

| Area | State |
|---|---|
| Layout: header, session timer, econ calendar, Nakshatra panel, focus cards, ETF/stock tables, selected signal, phone preview, paper account | Built, sample data |
| `lib/session.ts`: ET windows, DST, weekends, NYSE holidays, early closes | Built + tested |
| `lib/nakshatra.ts`: Moon sidereal longitude (astronomy-engine, Lahiri) → nakshatra/pada | Built + tested. Still needs checking against a published panchang |
| `POST /api/webhook/tradingview`: JSON parse, secret, watchlist/side/tf, optional IP check, de-dupe, Nakshatra tag | Built. Stores in memory until Supabase is connected |
| Login (single password, `src/proxy.ts`) | Built |
| `supabase/migrations/0001_init.sql`: 7 tables, unique index, Realtime, RLS, seed | Written, not applied |
| Paper engine, push senders, Yahoo market data, econ calendar sync, window-end cron | Stubs (return sample data or 503) |

## Waiting on the client

- `reference/nakshatras.json` is a **placeholder**. Swap in the client's table.
- `ut_bot_dual_webhook.pine` was not attached. Add it under `reference/`.
- Stocks 6–10 of the watchlist, the UT Bot settings, and the other open questions in SPEC.md.
- Spec note: its example "47.3° = Rohini pada 2" is really pada 3, because Rohini spans 40°–53°20′.

## Options risk plan (client, Nov 15 2026)

$250 of premium per trade. Stop at −20%. Targets at +40%, +75% and +100% of premium. See `src/lib/risk.ts` and its tests.
Still to confirm: how contracts are split across the targets (currently thirds), strike and expiry, whether SELL buys puts, and whether the stop moves after target 1.
