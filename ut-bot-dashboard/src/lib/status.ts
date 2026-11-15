import type { Signal } from "./types";

export type RowStatus = "FRESH" | "WAIT" | "BLOCKED" | "OUT";

export function rowStatus(s: Signal, refNow: number): RowStatus {
  if (s.status === "blocked_news") return "BLOCKED";
  if (s.window !== "opening" && s.window !== "power_hour") return "OUT";
  return refNow - s.bar_close_time <= 2 * 60_000 ? "FRESH" : "WAIT";
}

export function ageLabel(s: Signal, refNow: number): string {
  const m = Math.max(0, Math.floor((refNow - s.bar_close_time) / 60_000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d`;
}

/** latest signal per ticker */
export function latestByTicker(signals: Signal[]): Map<string, Signal> {
  const m = new Map<string, Signal>();
  for (const s of [...signals].sort((a, b) => b.bar_close_time - a.bar_close_time)) if (!m.has(s.ticker)) m.set(s.ticker, s);
  return m;
}
