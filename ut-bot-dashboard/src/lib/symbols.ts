export type SymbolKind = "stock" | "etf" | "context";

export interface WatchSymbol {
  ticker: string;
  yahooSymbol: string;
  sector: string;
  kind: SymbolKind;
  isPrimary: boolean;
  sortOrder: number;
  tradeable: boolean;
  /** true until the client confirms the final watchlist */
  placeholder?: boolean;
}

/**
 * The 16 tickers from the spec. Stocks 6–10 are placeholders until the client
 * sends the rest of the watchlist (open question #2). Mirrors the seed in
 * supabase/migrations/0001_init.sql — once Supabase is connected the DB is the
 * source of truth and this list is only the fallback.
 */
export const SYMBOLS: WatchSymbol[] = [
  { ticker: "QQQ", yahooSymbol: "QQQ", sector: "Tech", kind: "etf", isPrimary: true, sortOrder: 1, tradeable: true },
  { ticker: "SMH", yahooSymbol: "SMH", sector: "Semiconductors", kind: "etf", isPrimary: true, sortOrder: 2, tradeable: true },
  { ticker: "SOXL", yahooSymbol: "SOXL", sector: "Semiconductors", kind: "etf", isPrimary: false, sortOrder: 3, tradeable: true },
  { ticker: "SPY", yahooSymbol: "SPY", sector: "Broad market", kind: "etf", isPrimary: false, sortOrder: 4, tradeable: true },
  { ticker: "VIX", yahooSymbol: "^VIX", sector: "Volatility", kind: "context", isPrimary: false, sortOrder: 5, tradeable: false },
  { ticker: "CL1!", yahooSymbol: "CL=F", sector: "Energy", kind: "context", isPrimary: false, sortOrder: 6, tradeable: false },
  { ticker: "AAPL", yahooSymbol: "AAPL", sector: "Tech", kind: "stock", isPrimary: false, sortOrder: 10, tradeable: true },
  { ticker: "TSLA", yahooSymbol: "TSLA", sector: "Auto", kind: "stock", isPrimary: false, sortOrder: 11, tradeable: true },
  { ticker: "META", yahooSymbol: "META", sector: "Tech", kind: "stock", isPrimary: false, sortOrder: 12, tradeable: true },
  { ticker: "AMZN", yahooSymbol: "AMZN", sector: "Cloud", kind: "stock", isPrimary: false, sortOrder: 13, tradeable: true },
  { ticker: "MU", yahooSymbol: "MU", sector: "Semiconductors", kind: "stock", isPrimary: false, sortOrder: 14, tradeable: true },
  ...[6, 7, 8, 9, 10].map((n, i) => ({
    ticker: `STOCK${n}`,
    yahooSymbol: "",
    sector: "",
    kind: "stock" as const,
    isPrimary: false,
    sortOrder: 15 + i,
    tradeable: false,
    placeholder: true,
  })),
];

export const TRADINGVIEW_TICKER_ALIASES: Record<string, string> = { CL1: "CL1!", "CL1!": "CL1!", VIX: "VIX" };

export function findSymbol(ticker: string): WatchSymbol | undefined {
  const t = TRADINGVIEW_TICKER_ALIASES[ticker.toUpperCase()] ?? ticker.toUpperCase();
  return SYMBOLS.find((s) => s.ticker === t && !s.placeholder);
}
