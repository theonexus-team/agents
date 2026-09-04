# Trading strategy — 1-minute ORB + VWAP

Reference notes for the strategy this dashboard tracks. This is a discretionary/manual
strategy (not auto-executed by this app) — trades are placed by hand or via
TradingView → PickMyTrade → broker, and reported here via the TradingView webhook.

## Setup

- **Opening range**: first 1-minute candle of each tracked session — Tokyo, Shanghai,
  London, New York.
- **VWAP bias filter**: price below VWAP → sellers in control (look for shorts); price
  above VWAP → buyers in control (look for longs).

## Entry

1. Wait for a 1-min candle to **close** outside the opening range (the breakout).
2. **First entry**: enter in breakout direction, target 10 ticks, exit at target.
3. **Retest entry**: wait for price to retest back into the ORB zone.
   - If the retest **breaks through** the ORB zone → treat as a reversal, skip/flip.
   - If the retest **holds** (doesn't break the zone) → enter, hold for **$300** on
     **4 micro contracts**, run to the end (of session/day, per discretion).

## Confluence tools

- **Order block indicator** — marks order blocks / sell blocks, used to place stop-loss
  and take-profit levels for both the breakout and retest entries.
- **Bookmap liquidity indicator** — shows buyer/seller liquidity, used as a second
  source for reversal spots, TP, and SL placement.

## News rules (hard filters)

- No new trades **1 minute before/after** a high-impact release.
- **Never hold a trade into** a high-impact release — flat before it hits, regardless
  of the 1-minute window above.
- No holding a trade **30 minutes before or after** news generally.
- If the current ORB session falls **between two high-impact releases** (e.g. one just
  happened, another is within the next hour), **skip the session entirely**.
- High-impact earnings/economic releases cross-checked against investing.com,
  specifically watching how they affect the New York open.

## Where this shows up in the app

- `strategy` field on webhook payloads defaults to `"1m ORB + VWAP"` if not set
  explicitly (`src/app/api/webhook/tradingview/route.ts`).
- The econ calendar panel's copy (`src/app/page.tsx`) reflects the 1-min / no-hold /
  between-releases rules above — it's descriptive only, nothing in this app currently
  auto-blocks trades against it. Enforcement is on the trader/Pine Script side.
