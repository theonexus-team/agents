/**
 * Live display prices and 2m bars from Yahoo Finance (yahoo-finance2, server-side only).
 * Display only: signals always come from TradingView. Quotes cached 15 s, bars 60 s.
 * Falls back to sample data (source: "sample") if Yahoo errors, so pages never break.
 */
import YahooFinance from "yahoo-finance2";
import { SYMBOLS, findSymbol } from "./symbols";
import { sampleQuotes, sampleBars, type Quote } from "./sample";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
type Bar = { time: number; open: number; high: number; low: number; close: number };
const g = globalThis as unknown as { __utQuotes?: { at: number; data: Quote[] }; __utBars?: Map<string, { at: number; data: Bar[] }> };
g.__utBars ??= new Map();

const live = SYMBOLS.filter((s) => s.yahooSymbol && !s.placeholder);

export async function getQuotes(): Promise<{ source: "yahoo" | "sample"; quotes: Quote[] }> {
  if (g.__utQuotes && Date.now() - g.__utQuotes.at < 15_000) return { source: "yahoo", quotes: g.__utQuotes.data };
  try {
    const res = await yf.quote(live.map((s) => s.yahooSymbol));
    const arr = Array.isArray(res) ? res : [res];
    const quotes: Quote[] = live.flatMap((s) => {
      const q = arr.find((x) => x.symbol === s.yahooSymbol);
      if (!q || q.regularMarketPrice == null) return [];
      // Pre-market (7:00–9:30): use the pre-market price when Yahoo has one.
      const pre = q.marketState === "PRE" && q.preMarketPrice != null;
      return [{ ticker: s.ticker, price: pre ? q.preMarketPrice! : q.regularMarketPrice, change: pre ? (q.preMarketChange ?? 0) : (q.regularMarketChange ?? 0), changePct: pre ? (q.preMarketChangePercent ?? 0) : (q.regularMarketChangePercent ?? 0) }];
    });
    if (!quotes.length) throw new Error("no quotes");
    g.__utQuotes = { at: Date.now(), data: quotes };
    return { source: "yahoo", quotes };
  } catch (e) {
    console.error("yahoo quotes", (e as Error).message);
    return { source: "sample", quotes: sampleQuotes() };
  }
}

/** Last price for one ticker (for window-end closes). */
export async function lastPrice(ticker: string): Promise<number | null> {
  const { quotes } = await getQuotes();
  return quotes.find((q) => q.ticker === ticker)?.price ?? null;
}

/** 2m bars for the last ~2 trading days. */
export async function getBars(ticker: string): Promise<{ source: "yahoo" | "sample"; bars: Bar[] }> {
  const sym = findSymbol(ticker);
  if (!sym?.yahooSymbol) return { source: "sample", bars: sampleBars(ticker) };
  const hit = g.__utBars!.get(sym.ticker);
  if (hit && Date.now() - hit.at < 60_000) return { source: "yahoo", bars: hit.data };
  try {
    const c = await yf.chart(sym.yahooSymbol, { period1: new Date(Date.now() - 4 * 86_400_000), interval: "2m" });
    const bars = c.quotes
      .filter((q) => q.open != null && q.close != null && q.high != null && q.low != null)
      .map((q) => ({ time: Math.floor(new Date(q.date).getTime() / 1000), open: q.open!, high: q.high!, low: q.low!, close: q.close! }))
      .slice(-300);
    if (!bars.length) throw new Error("no bars");
    g.__utBars!.set(sym.ticker, { at: Date.now(), data: bars });
    return { source: "yahoo", bars };
  } catch (e) {
    console.error("yahoo bars", ticker, (e as Error).message);
    return { source: "sample", bars: sampleBars(ticker) };
  }
}
