/**
 * Paper trading engine. In memory until Supabase is connected.
 * Signal-to-signal / stop-and-reverse (client's rule): each signal closes the open trade on that symbol and opens a
 * new one in the signal's direction (BUY → long, SELL → short), continuously from 7:00 AM to 3:00 PM ET.
 * A repeat signal in the same direction is ignored. Everything still open closes at 3:00 PM (1:00 PM early close).
 * News blackout: the exit still happens, the new entry is skipped.
 * Size: 25% of current account value ÷ entry price, fractional shares to 4 decimals. No slippage/commission.
 */
import type { Signal } from "./types";

export type PaperSettings = { paper_mode: "long_only" | "flip"; size_mode: "percent"; size_value: number; starting_balance: number; auto_close_at_window_end: boolean };
export type Position = { id: string; ticker: string; side: "long" | "short"; qty: number; entry_price: number; entry_signal_id: string; opened_at: string; window: Signal["window"]; nak_name?: string; tone?: string };
export type Trade = { id: string; ticker: string; side: "long" | "short"; qty: number; entry_price: number; exit_price: number; pnl_usd: number; pnl_pct: number; opened_at: string; closed_at: string; exit_reason: "opposite_signal" | "window_end" | "manual"; entry_signal_id: string; exit_signal_id: string | null; window: Signal["window"]; nak_name?: string; tone?: string };

export const DEFAULT_SETTINGS: PaperSettings = { paper_mode: "flip", size_mode: "percent", size_value: 25, starting_balance: 1000, auto_close_at_window_end: true };

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
  const dir = p.side === "long" ? 1 : -1;
  const pnl = (price - p.entry_price) * p.qty * dir;
  s.cash += p.qty * p.entry_price + pnl; // collateral back + P&L (longs and shorts alike)
  s.positions = s.positions.filter((x) => x.id !== p.id);
  const t: Trade = { id: crypto.randomUUID(), ticker: p.ticker, side: p.side, qty: p.qty, entry_price: p.entry_price, exit_price: price, pnl_usd: r2(pnl), pnl_pct: r2(((price - p.entry_price) / p.entry_price) * 100 * dir), opened_at: p.opened_at, closed_at: at.toISOString(), exit_reason: reason, entry_signal_id: p.entry_signal_id, exit_signal_id: exitSignalId, window: p.window, nak_name: p.nak_name, tone: p.tone };
  s.trades.unshift(t);
  return t;
}

const markOf = (p: Position, marks: Record<string, number>) => marks[p.ticker] ?? p.entry_price;
const unreal = (p: Position, marks: Record<string, number>) => (markOf(p, marks) - p.entry_price) * p.qty * (p.side === "long" ? 1 : -1);

/** Apply one signal (stop-and-reverse). Exits always go through; entries need status "accepted" (in window, no blackout). */
export function applySignal(sig: Signal, marks: Record<string, number> = {}): { action: "opened" | "closed" | "reversed" | "ignored"; reason?: string } {
  const s = st();
  const want: Position["side"] = sig.side === "BUY" ? "long" : "short";
  const open = s.positions.find((p) => p.ticker === sig.ticker);
  if (open && open.side === want) return { action: "ignored", reason: `already_${want}` };
  const px = sig.price > 0 ? sig.price : null;
  let closed = false;
  if (open) { close(open, px ?? open.entry_price, "opposite_signal", sig.id, new Date(sig.bar_close_time)); closed = true; }
  if (s.settings.paper_mode === "long_only" && want === "short") return closed ? { action: "closed" } : { action: "ignored", reason: "flat" };
  if (sig.status !== "accepted") return closed ? { action: "closed", reason: sig.status } : { action: "ignored", reason: sig.status };
  if (!px) return closed ? { action: "closed", reason: "no_price" } : { action: "ignored", reason: "no_price" };
  const equity = s.cash + s.positions.reduce((a, p) => a + p.qty * p.entry_price + unreal(p, marks), 0);
  const budget = Math.min(s.cash, equity * (s.settings.size_value / 100));
  const qty = r4(budget / px);
  if (qty <= 0) return closed ? { action: "closed", reason: "no_cash" } : { action: "ignored", reason: "no_cash" };
  s.cash -= qty * px; // collateral (same for shorts in v1)
  s.positions.push({ id: crypto.randomUUID(), ticker: sig.ticker, side: want, qty, entry_price: px, entry_signal_id: sig.id, opened_at: new Date(sig.bar_close_time).toISOString(), window: sig.window, nak_name: (sig as { nak_name?: string }).nak_name, tone: (sig as { tone?: string }).tone });
  return { action: closed ? "reversed" : "opened" };
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
  const openPnl = s.positions.reduce((a, p) => a + unreal(p, marks), 0);
  const value = s.cash + s.positions.reduce((a, p) => a + p.qty * p.entry_price + unreal(p, marks), 0);
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
    positions: s.positions.map((p) => ({ ...p, mark: markOf(p, marks), pnl: r2(unreal(p, marks)) })),
    trades: s.trades, byWindow: by((t) => t.window), bySymbol: by((t) => t.ticker), byTone: by((t) => t.tone), byNakshatra: by((t) => t.nak_name),
    settings: s.settings,
  };
}
