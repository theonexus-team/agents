/**
 * Paper trading engine (spec "Paper trading engine"). In memory until Supabase is connected.
 * Long-only (client's choice): BUY flat → open long; BUY while long → ignore; SELL while long → close;
 * SELL flat → ignore. Auto-close at window end (11:00 AM / 4:00 PM ET) at the last Yahoo price.
 * Size: 25% of current account value ÷ entry price, fractional shares to 4 decimals. No slippage/commission.
 */
import type { Signal } from "./types";

export type PaperSettings = { paper_mode: "long_only" | "flip"; size_mode: "percent"; size_value: number; starting_balance: number; auto_close_at_window_end: boolean };
export type Position = { id: string; ticker: string; side: "long"; qty: number; entry_price: number; entry_signal_id: string; opened_at: string; window: Signal["window"]; nak_name?: string; tone?: string };
export type Trade = { id: string; ticker: string; side: "long"; qty: number; entry_price: number; exit_price: number; pnl_usd: number; pnl_pct: number; opened_at: string; closed_at: string; exit_reason: "opposite_signal" | "window_end" | "manual"; entry_signal_id: string; exit_signal_id: string | null; window: Signal["window"]; nak_name?: string; tone?: string };

export const DEFAULT_SETTINGS: PaperSettings = { paper_mode: "long_only", size_mode: "percent", size_value: 25, starting_balance: 1000, auto_close_at_window_end: true };

type State = { settings: PaperSettings; cash: number; positions: Position[]; trades: Trade[] };
const g = globalThis as unknown as { __utPaper?: State };
const fresh = (s = DEFAULT_SETTINGS): State => ({ settings: s, cash: s.starting_balance, positions: [], trades: [] });
g.__utPaper ??= fresh();
const st = () => g.__utPaper!;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

export const getPaper = () => st();
export function resetPaper(startingBalance?: number) {
  g.__utPaper = fresh({ ...st().settings, ...(startingBalance ? { starting_balance: startingBalance } : {}) });
  return st();
}

function close(p: Position, price: number, reason: Trade["exit_reason"], exitSignalId: string | null, at = new Date()) {
  const s = st();
  const pnl = (price - p.entry_price) * p.qty;
  s.cash += p.qty * price;
  s.positions = s.positions.filter((x) => x.id !== p.id);
  const t: Trade = { id: crypto.randomUUID(), ticker: p.ticker, side: "long", qty: p.qty, entry_price: p.entry_price, exit_price: price, pnl_usd: r2(pnl), pnl_pct: r2(((price - p.entry_price) / p.entry_price) * 100), opened_at: p.opened_at, closed_at: at.toISOString(), exit_reason: reason, entry_signal_id: p.entry_signal_id, exit_signal_id: exitSignalId, window: p.window, nak_name: p.nak_name, tone: p.tone };
  s.trades.unshift(t);
  return t;
}

/** Apply one signal. Only signals the webhook marked tradeable reach here (accepted, or SELL during a news blackout). */
export function applySignal(sig: Signal, marks: Record<string, number> = {}): { action: "opened" | "closed" | "ignored"; reason?: string } {
  const s = st();
  const open = s.positions.find((p) => p.ticker === sig.ticker);
  if (sig.side === "BUY") {
    if (sig.status !== "accepted") return { action: "ignored", reason: sig.status };
    if (open) return { action: "ignored", reason: "already_long" };
    if (!(sig.price > 0)) return { action: "ignored", reason: "no_price" };
    const equity = s.cash + s.positions.reduce((a, p) => a + p.qty * (marks[p.ticker] ?? p.entry_price), 0);
    const budget = Math.min(s.cash, equity * (s.settings.size_value / 100));
    const qty = r4(budget / sig.price);
    if (qty <= 0) return { action: "ignored", reason: "no_cash" };
    s.cash -= qty * sig.price;
    s.positions.push({ id: crypto.randomUUID(), ticker: sig.ticker, side: "long", qty, entry_price: sig.price, entry_signal_id: sig.id, opened_at: new Date(sig.bar_close_time).toISOString(), window: sig.window, nak_name: (sig as { nak_name?: string }).nak_name, tone: (sig as { tone?: string }).tone });
    return { action: "opened" };
  }
  // SELL: exits always go through (even in a news blackout or outside a window).
  if (!open) return { action: "ignored", reason: "flat" };
  close(open, sig.price > 0 ? sig.price : open.entry_price, "opposite_signal", sig.id, new Date(sig.bar_close_time));
  return { action: "closed" };
}

/** Window end: close everything at the last price. */
export async function closeAllAtWindowEnd(priceOf: (ticker: string) => Promise<number | null>) {
  const s = st();
  if (!s.settings.auto_close_at_window_end) return [];
  const out: Trade[] = [];
  for (const p of [...s.positions]) out.push(close(p, (await priceOf(p.ticker)) ?? p.entry_price, "window_end", null));
  return out;
}

/** Account summary + stats for /paper and the dashboard card. */
export function paperSummary(marks: Record<string, number> = {}) {
  const s = st();
  const openPnl = s.positions.reduce((a, p) => a + (((marks[p.ticker] ?? p.entry_price) - p.entry_price) * p.qty), 0);
  const value = s.cash + s.positions.reduce((a, p) => a + p.qty * (marks[p.ticker] ?? p.entry_price), 0);
  const wins = s.trades.filter((t) => t.pnl_usd > 0), losses = s.trades.filter((t) => t.pnl_usd <= 0);
  const avg = (xs: Trade[]) => (xs.length ? r2(xs.reduce((a, t) => a + t.pnl_usd, 0) / xs.length) : 0);
  const by = <K extends string>(key: (t: Trade) => K | undefined) => {
    const m = new Map<K, Trade[]>();
    for (const t of s.trades) { const k = key(t); if (k) m.set(k, [...(m.get(k) ?? []), t]); }
    return [...m.entries()].map(([k, ts]) => ({ key: k, pnl: r2(ts.reduce((a, t) => a + t.pnl_usd, 0)), trades: ts.length, win: Math.round((ts.filter((t) => t.pnl_usd > 0).length / ts.length) * 100) }));
  };
  return {
    start: s.settings.starting_balance, value: r2(value), cash: r2(s.cash), realized: r2(s.trades.reduce((a, t) => a + t.pnl_usd, 0)), open: r2(openPnl),
    closed: s.trades.length, wins: wins.length, winRate: s.trades.length ? Math.round((wins.length / s.trades.length) * 100) : 0, avgWin: avg(wins), avgLoss: avg(losses),
    positions: s.positions.map((p) => ({ ...p, mark: marks[p.ticker] ?? p.entry_price, pnl: r2(((marks[p.ticker] ?? p.entry_price) - p.entry_price) * p.qty) })),
    trades: s.trades, byWindow: by((t) => t.window), bySymbol: by((t) => t.ticker), byTone: by((t) => t.tone), byNakshatra: by((t) => t.nak_name),
    settings: s.settings,
  };
}
