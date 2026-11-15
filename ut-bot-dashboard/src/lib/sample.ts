/**
 * Sample data shown until TradingView, Supabase and Yahoo are connected.
 * Mirrors the prototype. Signal times are relative to "now" so the status
 * rules (FRESH / WAIT / OUT OF WINDOW) run on the real clock.
 */
import { SYMBOLS, findSymbol } from "./symbols";
import { snapshotFor } from "./nakshatra";
import { windowAt } from "./session";
import { fromZonedTime } from "date-fns-tz";
import type { Signal, Side } from "./types";

export interface Quote { ticker: string; price: number; change: number; changePct: number }

const BASE: Record<string, [number, number]> = {
  QQQ: [690.39, 2.39], SMH: [503.08, -2.92], SOXL: [66.02, -0.38], SPY: [760.19, 0.19],
  VIX: [17.8, 0.05], "CL1!": [88.2, 0.2], AAPL: [356.13, 1.13], TSLA: [392.02, -0.98],
  META: [625.77, -2.23], AMZN: [269.56, 2.06], MU: [793.44, -6.56],
};

export function sampleQuotes(): Quote[] {
  return SYMBOLS.filter((s) => BASE[s.ticker]).map((s) => {
    const [price, change] = BASE[s.ticker];
    return { ticker: s.ticker, price, change, changePct: (change / (price - change)) * 100 };
  });
}

export function sampleBars(ticker: string) {
  const [price] = BASE[ticker] ?? [100, 0];
  const now = Math.floor(Date.now() / 120_000) * 120;
  let p = price * 0.995;
  let seed = [...ticker].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) - 0.5;
  return Array.from({ length: 60 }, (_, i) => {
    const o = p;
    p = p + rnd() * price * 0.002 + (price - p) * 0.05;
    return { time: now - (59 - i) * 120, open: o, high: Math.max(o, p) * 1.0005, low: Math.min(o, p) * 0.9995, close: p };
  });
}

// [ticker, side, minutes ago, signal price, blocked by news?]
const ROWS: [string, Side, number, number, boolean][] = [
  ["SPY", "BUY", 0, 760.0, false], ["VIX", "BUY", 0, 17.75, false], ["CL1!", "BUY", 4, 88.0, false],
  ["SOXL", "BUY", 18, 66.4, true], ["SMH", "SELL", 22, 506.0, false], ["QQQ", "BUY", 24, 688.0, false],
  ["AAPL", "BUY", 1, 355.0, false], ["TSLA", "SELL", 2, 393.0, false], ["META", "BUY", 16, 628.0, true],
  ["AMZN", "BUY", 24, 267.5, false], ["MU", "SELL", 24, 800.0, false],
];

export function sampleSignals(now = Date.now()): Signal[] {
  const closedBar = Math.floor(now / 120_000) * 120_000;
  return ROWS.map(([ticker, side, ago, price, blocked], i) => {
    const sym = findSymbol(ticker)!;
    const close = closedBar - Math.ceil(ago / 2) * 120_000;
    const win = windowAt(new Date(close));
    return {
      id: `sample-${i}`,
      ticker, side, setup: side === "BUY" ? "UT1" : "UT2", price, tf: "2",
      bar_time: close - 120_000, bar_close_time: close, window: win,
      received_at: new Date(close + 1500).toISOString(),
      status: !sym.tradeable ? "context_only" : blocked ? "blocked_news" : win === "pre_market" || win === "opening" || win === "power_hour" ? "accepted" : "outside_window",
      ut_key: side === "BUY" ? 1 : 2, ut_atr_len: 10, ut_heikin: false, ut_stop: null, atr: null,
      news_state: blocked ? "blackout" : "clear", nearest_event: blocked ? "Fed Chair speech" : null, minutes_to_event: blocked ? 5 : null,
      sample: true,
      ...snapshotFor(new Date(close), ticker, sym.sector),
    };
  });
}

export const SAMPLE_ECON = [
  { time: "8:30 AM", impact: "High", title: "CPI m/m", detail: "A 0.3% · F 0.3% · P 0.2%", state: "Released" },
  { time: "8:30 AM", impact: "Medium", title: "Initial Jobless Claims", detail: "A 221K · F 225K · P 219K", state: "Released" },
  { time: "9:45 AM", impact: "High", title: "Fed Chair speech", detail: "A – · F – · P –", state: "Released" },
  { time: "10:30 AM", impact: "Medium", title: "EIA Crude Oil Inventories", detail: "A – · F -1.1M · P 2.4M", state: "upcoming" },
  { time: "1:00 PM", impact: "Medium", title: "30-Year Bond Auction", detail: "A – · F – · P 4.71%", state: "upcoming" },
];

export const SAMPLE_PAPER = {
  start: 1000, value: 1030.03, realized: 28.25, open: 1.78, winRate: 67, closed: 45, wins: 30, avgWin: 1.46, avgLoss: -1.03,
  positions: [
    { ticker: "AAPL", qty: 0.724, entry: 355.0, window: "Opening", pnl: 0.82 },
    { ticker: "SPY", qty: 0.338, entry: 760.0, window: "Opening", pnl: 0.06 },
    { ticker: "QQQ", qty: 0.374, entry: 688.0, window: "Opening", pnl: 0.89 },
  ],
  byTone: [
    { tone: "Calm", pnl: 13.74, trades: 14, win: 86 },
    { tone: "Volatile", pnl: 8.46, trades: 19, win: 63 },
    { tone: "Harmonious", pnl: 6.06, trades: 12, win: 50 },
  ],
};

/**
 * Reference clock for sample mode: real now if a window is live, otherwise
 * 10:02:08 AM ET on the most recent trading day, so the preview looks like the prototype.
 */
export function sampleClock(now = new Date()): Date {
  const cur = windowAt(now);
  if (cur === "opening" || cur === "power_hour") return now;
  for (let i = 0; i < 10; i++) {
    const day = new Date(now.getTime() - i * 86_400_000);
    const key = day.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const probe = fromZonedTime(`${key}T10:02:08`, "America/New_York");
    if (probe.getTime() <= now.getTime() && windowAt(probe) === "opening") return probe;
  }
  return now;
}
