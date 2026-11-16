/**
 * Durable event log on Vercel Blob (private store). Every server instance reads the same data, so signals received by
 * one instance show on every page. One small JSON file per event:
 *   events/<ms time, 13 digits>-signal-<ticker>-<side>-<bar_time>.json   (deterministic name = de-duplication)
 *   events/<ms time>-window_end-<id>.json    3:00 PM close with the prices used
 *   events/<ms time>-reset-<id>.json         paper account reset
 * Paper trading is rebuilt by replaying the events in order, so it survives restarts too.
 * Without BLOB_READ_WRITE_TOKEN (local tests) it falls back to memory.
 */
import { put, list, get } from "@vercel/blob";
import type { Signal } from "./types";
import { applySignal, closeAllAtWindowEnd, resetPaper } from "./paper";

export type StoredEvent =
  | { kind: "signal"; at: number; signal: Signal; marks: Record<string, number> }
  | { kind: "window_end"; at: number; prices: Record<string, number> }
  | { kind: "reset"; at: number; starting_balance?: number };

const PREFIX = "events/";
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const g = globalThis as unknown as { __utEvents?: Map<string, StoredEvent>; __utLoadedAt?: number; __utBuiltFrom?: string };
g.__utEvents ??= new Map();
const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(13, "0");
const safe = (s: string) => s.replace(/[^A-Za-z0-9_!.-]/g, "_");

/** Append one event. Returns false if that exact signal was already stored (TradingView retries). */
export async function appendEvent(e: StoredEvent): Promise<boolean> {
  const name = e.kind === "signal"
    ? `${PREFIX}${pad(e.signal.bar_close_time)}-signal-${safe(e.signal.ticker)}-${e.signal.side}-${e.signal.bar_time}.json`
    : `${PREFIX}${pad(e.at)}-${e.kind}-${crypto.randomUUID().slice(0, 8)}.json`;
  if (e.kind === "signal" && [...g.__utEvents!.values()].some((x) => x.kind === "signal" && x.signal.ticker === e.signal.ticker && x.signal.side === e.signal.side && x.signal.bar_time === e.signal.bar_time)) return false;
  if (useBlob()) {
    try {
      await put(name, JSON.stringify(e), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false });
    } catch (err) {
      if (/already exists/i.test((err as Error).message)) return false;
      throw err;
    }
  }
  g.__utEvents!.set(name, e);
  return true;
}

/** Load all events (new files only; contents cached per instance). */
async function load() {
  if (!useBlob()) return;
  if (g.__utLoadedAt && Date.now() - g.__utLoadedAt < 3_000) return;
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    names.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const keep = new Set(names);
  for (const k of [...g.__utEvents!.keys()]) if (!keep.has(k)) g.__utEvents!.delete(k); // removed in the store
  const missing = names.filter((n) => !g.__utEvents!.has(n));
  for (let i = 0; i < missing.length; i += 20) {
    await Promise.all(missing.slice(i, i + 20).map(async (n) => {
      const r = await get(n, { access: "private" });
      if (r && "stream" in r && r.stream) g.__utEvents!.set(n, JSON.parse(await new Response(r.stream).text()) as StoredEvent);
    }));
  }
  g.__utLoadedAt = Date.now();
}

const ordered = () => [...g.__utEvents!.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, e]) => e);

/** Bring signals + paper account up to date. Call before reading either. */
export async function syncState() {
  await load();
  const evs = ordered();
  const key = `${evs.length}:${g.__utEvents!.size}:${[...g.__utEvents!.keys()].sort().at(-1) ?? ""}`;
  if (g.__utBuiltFrom === key) return;
  resetPaper(undefined, true);
  for (const e of evs) {
    if (e.kind === "reset") resetPaper(e.starting_balance, true);
    else if (e.kind === "signal") { if (e.signal.status !== "context_only") applySignal(e.signal, e.marks); }
    else await closeAllAtWindowEnd(async (t) => e.prices[t] ?? null, new Date(e.at));
  }
  g.__utBuiltFrom = key;
}

export function listSignals(): Signal[] {
  return ordered().flatMap((e) => (e.kind === "signal" ? [e.signal] : [])).sort((a, b) => b.bar_close_time - a.bar_close_time);
}

export const lastWebhookAt = () => listSignals().reduce<string | null>((m, s) => (!m || s.received_at > m ? s.received_at : m), null);
