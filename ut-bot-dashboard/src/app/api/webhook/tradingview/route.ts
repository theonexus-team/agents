import { newsStateAt } from "@/lib/econCalendar";
import { getQuotes } from "@/lib/marketData";
import { NextResponse } from "next/server";
import { findSymbol } from "@/lib/symbols";
import { windowAt, isTradeableWindow } from "@/lib/session";
import { snapshotFor } from "@/lib/nakshatra";
import { appendEvent } from "@/lib/store";
import type { Signal } from "@/lib/types";

const TV_IPS = ["52.89.214.238", "34.212.75.30", "54.218.53.128", "52.32.178.7"];

/**
 * TradingView must get a 200 within 3 s and never retries, so this only
 * validates + stores; paper engine and push run in after() (waitUntil on Vercel).
 */
export async function POST(req: Request) {
  // 1. TradingView sends text/plain — read raw then parse.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // 2. Shared secret.
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || body.secret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // 3. Watchlist / side / timeframe.
  const sym = typeof body.ticker === "string" ? findSymbol(body.ticker) : undefined;
  const side = body.side;
  if (!sym || (side !== "BUY" && side !== "SELL") || String(body.tf) !== "2") {
    return NextResponse.json({ ok: false, error: "ticker not in watchlist, bad side, or tf != 2" }, { status: 422 });
  }

  // 4. Optional source-IP check.
  if (process.env.WEBHOOK_ENFORCE_IP === "true") {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    if (!TV_IPS.includes(ip)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const num = (v: unknown) => (typeof v === "number" ? v : v != null && !isNaN(Number(v)) ? Number(v) : null);
  const barTime = num(body.bar_time) ?? Date.now();
  const barClose = num(body.bar_close_time) ?? barTime + 120_000;
  const win = windowAt(new Date(barClose));

  const signal: Signal = {
    id: crypto.randomUUID(),
    ticker: sym.ticker,
    side,
    setup: String(body.setup ?? (side === "BUY" ? "UT1" : "UT2")),
    price: num(body.price) ?? 0,
    tf: "2",
    bar_time: barTime,
    bar_close_time: barClose,
    window: win,
    received_at: new Date().toISOString(),
    status: !sym.tradeable ? "context_only" : isTradeableWindow(win) ? "accepted" : "outside_window",
    ut_key: num(body.ut_key),
    ut_atr_len: num(body.ut_atr_len),
    ut_heikin: typeof body.ut_heikin === "boolean" ? body.ut_heikin : null,
    ut_stop: num(body.ut_stop),
    atr: num(body.atr),
    // News filter (Forex Factory, USD): High impact ±10 min blocks new entries; exits always go through.
    ...(await newsStateAt(new Date(barClose))),
    ...snapshotFor(new Date(barClose), sym.ticker, sym.sector),
  };

  // Stop-and-reverse: in a blackout the exit still happens, the new entry (either side) is skipped.
  if (signal.status === "accepted" && signal.news_state === "blackout") signal.status = "blocked_news";

  // 5–6. De-duplicate + store durably (Vercel Blob). Paper trades are rebuilt from the stored signals,
  // using the live prices captured here for position sizing.
  const { quotes } = await getQuotes();
  const inserted = await appendEvent({ kind: "signal", at: Date.now(), signal, marks: Object.fromEntries(quotes.map((q) => [q.ticker, q.price])) });
  if (!inserted) return NextResponse.json({ ok: true, duplicate: true });

  return NextResponse.json({ ok: true, id: signal.id, window: win, status: signal.status, nakshatra: signal.nak_name });
}

export function GET() {
  return NextResponse.json({ ok: true, hint: "POST TradingView alert JSON here" });
}
