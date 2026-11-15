/**
 * Temporary in-memory signal store, used until Supabase is connected so the
 * webhook can be exercised end to end locally. Lost on every restart.
 * Replace with Supabase inserts (unique index on ticker, side, bar_time).
 */
import type { Signal } from "./types";

const g = globalThis as unknown as { __utbotSignals?: Signal[]; __utbotLastWebhook?: string };
g.__utbotSignals ??= [];

export function listSignals(): Signal[] {
  return [...g.__utbotSignals!].sort((a, b) => b.bar_close_time - a.bar_close_time);
}

/** returns false when (ticker, side, bar_time) already exists */
export function insertSignal(s: Signal): boolean {
  if (g.__utbotSignals!.some((x) => x.ticker === s.ticker && x.side === s.side && x.bar_time === s.bar_time)) return false;
  g.__utbotSignals!.push(s);
  g.__utbotLastWebhook = s.received_at;
  return true;
}

export const lastWebhookAt = () => g.__utbotLastWebhook ?? null;
