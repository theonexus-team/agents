# UT Bot Dashboard

TradingView UT Bot signals (16 symbols, 2m, NY session) → webhook → paper trading + phone push.
Full spec: [SPEC.md](SPEC.md) (text export of the build spec PDF).

**Status: live (no database yet).** Live Yahoo prices/bars, Forex Factory calendar + news filter, paper engine and window-end cron are wired. Signals and paper trades are kept in server memory until Supabase is connected (lost on restart).
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
| `POST /api/webhook/tradingview`: JSON parse, secret, watchlist/side/tf, optional IP check, de-dupe, Nakshatra tag, news filter (High ±10 min blocks BUYs), paper engine | Built. Stores in memory until Supabase is connected |
| Login (single password, `src/proxy.ts`) | Built |
| `supabase/migrations/0001_init.sql`: 7 tables, unique index, Realtime, RLS, seed | Written, not applied |
| `lib/marketData.ts`: Yahoo quotes (15 s cache) + 2m bars (60 s), sample fallback | Built |
| `lib/econCalendar.ts`: Forex Factory weekly feed (USD), today's events panel, blackout check | Built |
| `lib/paper.ts`: long-only, 25% of equity per trade, fractional shares, window-end auto-close, stats, reset | Built + tested (in memory) |
| `/api/cron/window-end` + `vercel.json` crons (UTC hours covering EST/EDT and early closes) | Built |
| Push senders | Not wired (client chose to skip for now; TradingView's own app push works) |

## Waiting on the client

- ~~`reference/nakshatras.json` placeholder~~ Done: the client's table (Nov 15 2026) is in. Sector matching is word-based ("Large Cap Tech" matches a Tech symbol).
- `reference/ut_bot_dual_webhook.pine` (v1.5) is in. Its Key Value / ATR inputs are still placeholders (Setup 1 = 1.0 / 10, Setup 2 = 2.0 / 10).
- Stocks 6–10 of the watchlist, the UT Bot settings, and the other open questions in SPEC.md.
- Spec note: its example "47.3° = Rohini pada 2" is really pada 3, because Rohini spans 40°–53°20′.

## Options risk plan (client, Nov 15 2026)

$250 of premium per trade. Stop at −20%. Targets at +40%, +75% and +100% of premium. See `src/lib/risk.ts` and its tests.
Still to confirm: how contracts are split across the targets (currently thirds), strike and expiry, whether SELL buys puts, and whether the stop moves after target 1.
