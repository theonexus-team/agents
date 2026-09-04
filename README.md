# Theonexus Trading Oracle

A paper-trading algo dashboard: session countdowns, live paper P&L, a trade log fed by
TradingView webhook alerts, and desk-key-gated engine controls to pause/resume trading
per instrument.

**Live production URL:** https://theonexus-trading-oracle.vercel.app
Hosted on Vercel (project `theonexux/theonexus-trading-oracle`), database on Neon (project region
`us-east-2`). Deploy updates with `npx vercel deploy --prod --token=<VERCEL_TOKEN>` from
this directory (`vercel link` already ran, so it's tied to the right project).

**Gotcha learned the hard way:** `vercel env add NAME production` piped via stdin
(`$value | vercel env add ...`) silently corrupted values in this environment. Always use
`vercel env add NAME production --value "<value>" --no-sensitive` instead, then verify
with `vercel env pull` before trusting it.

## TradingView webhook setup (production)

Point TradingView alerts at:
```
https://theonexus-trading-oracle.vercel.app/api/webhook/tradingview
```
with `"secret"` in the JSON body matching `TRADINGVIEW_WEBHOOK_SECRET` (see `.env` for
the current value — it's a real generated secret, not a placeholder). See "Wiring up
TradingView" below for the entry/exit JSON payload shape.

If you're also routing trades through PickMyTrade (or any other execution bridge) to a
broker, add this as a **second, separate TradingView alert** on the same condition —
one alert to your execution bridge, one alert to this URL to log it here. PickMyTrade
has no read API to pull data back out, so mirroring the alert is the only way trades
placed through it show up on this dashboard.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- No external price/economic-calendar API is wired up yet — see "Data sources" below.

## Local setup

Prerequisites already installed on this machine: Node.js LTS, PostgreSQL 17 (running as a
Windows service, database `kol_desk`, user `postgres` / password `kol_desk_dev_pw` — see `.env`).

```bash
npm install
npx prisma generate
npx prisma db push   # sync schema to the database
npx tsx prisma/seed.ts   # seed sample instruments + ~70 sample trades
npm run dev
```

Then open http://localhost:3000.

## Environment variables (`.env`)

- `DATABASE_URL` — Postgres connection string.
- `TRADINGVIEW_WEBHOOK_SECRET` — shared secret your Pine Script alert must send so
  `/api/webhook/tradingview` accepts it. **Change this from the placeholder before going live.**
- `DESK_KEY` — the admin key used by the "Engine controls" panel to pause/resume trading.
  **Change this from the placeholder before going live.**

## Wiring up TradingView

Point your strategy's alert webhook at `POST /api/webhook/tradingview` with a JSON body:

Entry:
```json
{
  "secret": "...", "action": "entry", "symbol": "MGC", "direction": "LONG",
  "session": "NEW_YORK", "strategy": "Tab reversal",
  "entryPrice": 4300.5, "stopPrice": 4290.5, "targetPrice": 4320.5
}
```

Exit (closes the most recent open position for that symbol):
```json
{ "secret": "...", "action": "exit", "symbol": "MGC", "exitPrice": 4315.25 }
```

`symbol` must be one of `MGC`, `HG`, `MNQ` (add more via the `InstrumentSymbol` enum in
`prisma/schema.prisma` + a row in `prisma/seed.ts` or directly in the DB). Net P&L is
computed from the instrument's `riskPerTrade` scaled by how far the exit moved relative to
the stop distance.

## Engine controls

The dashboard's pause/resume buttons call `POST /api/engine/control` with the `DESK_KEY`.
Pausing an instrument stops new entries from that instrument's webhook alerts (checked
server-side in the entry handler); it does not touch positions already open.

## Live integrations

**Economic calendar (Finnhub)** — set `FINNHUB_API_KEY` in `.env` (free tier at
finnhub.io) and `/api/dashboard` pulls the next-24h calendar live (5 min cache), tagging
`impact: "high"` events as blackout events. Leave it blank to fall back to the
DB-seeded `EconomicEvent` rows.

**Funded accounts (Tradovate)** — read-only balances/positions, no order placement.
Set in `.env`:
- `TRADOVATE_ENV` — `demo` or `live`
- `TRADOVATE_APP_ID` / `TRADOVATE_APP_VERSION` — the app name/version you registered
  for API access
- `TRADOVATE_CID` / `TRADOVATE_SEC` — client ID/secret issued when you registered
- `TRADOVATE_USERNAME` / `TRADOVATE_PASSWORD` — your Tradovate login

Client lives at `src/lib/providers/tradovate.ts` (auth token caching + `/account/list`,
`/cashBalance/list`, `/position/list`, `/contract/list`), exposed at `GET /api/accounts`
and rendered by the "Funded accounts" panel. Leave the Tradovate vars blank and that
panel just says it isn't connected.

**Price data health** — live quotes from Yahoo Finance's public, unauthenticated chart
endpoint (`src/lib/providers/yahoo.ts`), no account or API key needed. Maps MGC→`GC=F`,
HG→`HG=F`, MNQ→`NQ=F` (continuous front-month futures; the micro contracts track these
1:1 per point). Falls back to the DB-seeded `PriceHealth` row per instrument if the live
fetch fails. This is a stand-in for the exchange's own delayed feed — swap in a real
market-data vendor (or Tradovate's WebSocket feed once that's connected) if you need
exchange-licensed data instead of Yahoo's.

## Trade data model

- `OpenPosition` — created on a TradingView "entry" webhook, deleted on "exit".
- `Trade` — the closed-trade record used everywhere on the dashboard (trade log, stats,
  balance). `includedInRuleset: false` hides a trade from the public stats without deleting
  it (mirrors "hidden, not deleted" trades from legacy/disabled setups).
- `Signal` — a lightweight feed entry created alongside each entry webhook.
