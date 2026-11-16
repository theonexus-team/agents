import { NextResponse } from "next/server";
import { getSessionState, windowEnds } from "@/lib/session";
import { getPaper } from "@/lib/paper";
import { lastPrice } from "@/lib/marketData";
import { appendEvent, syncState } from "@/lib/store";

/** Scheduled in UTC for both EST and EDT (vercel.json); the route decides whether it's really window end in ET. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const due = windowEnds(now).some((t) => Math.abs(now.getTime() - t.getTime()) < 10 * 60_000);
  if (!due) return NextResponse.json({ ok: true, due, session: getSessionState(now).phase });
  await syncState();
  const open = getPaper().positions;
  const prices: Record<string, number> = {};
  for (const p of open) { const px = await lastPrice(p.ticker); if (px) prices[p.ticker] = px; }
  await appendEvent({ kind: "window_end", at: now.getTime(), prices });
  return NextResponse.json({ ok: true, due, closed: open.map((p) => ({ ticker: p.ticker, side: p.side, exit: prices[p.ticker] ?? p.entry_price })), session: getSessionState(now).phase });
}
