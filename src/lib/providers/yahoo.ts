/**
 * Public, unauthenticated Yahoo Finance quote feed — no account or API key required.
 * Used as a stand-in for the exchange's own delayed feed on the Price Data Health panel.
 */

import type { InstrumentSymbol } from "@/lib/types";

// Continuous front-month futures tickers. Micro contracts (MGC/MNQ) track the
// full-size contract price 1:1 per point, just at a smaller multiplier, so the
// full-size ticker is a faithful price reference.
const YAHOO_TICKER: Record<InstrumentSymbol, string> = {
  MGC: "GC=F",
  HG: "HG=F",
  MNQ: "NQ=F",
  MES: "ES=F",
};

export type LiveQuote = {
  symbol: InstrumentSymbol;
  price: number;
  quotedAt: string;
};

let cache: { at: number; quotes: LiveQuote[] } | null = null;
const CACHE_MS = 60 * 1000;

async function fetchOne(symbol: InstrumentSymbol): Promise<LiveQuote | null> {
  const ticker = YAHOO_TICKER[symbol];
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const time = meta?.regularMarketTime;
    if (typeof price !== "number" || typeof time !== "number") return null;
    return { symbol, price, quotedAt: new Date(time * 1000).toISOString() };
  } catch {
    return null;
  }
}

export async function getLiveQuotes(symbols: InstrumentSymbol[]): Promise<LiveQuote[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.quotes.filter((q) => symbols.includes(q.symbol));
  }

  const results = await Promise.all(symbols.map(fetchOne));
  const quotes = results.filter((q): q is LiveQuote => q !== null);
  cache = { at: Date.now(), quotes };
  return quotes;
}
