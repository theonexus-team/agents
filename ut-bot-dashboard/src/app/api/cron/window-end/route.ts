import { NextResponse } from "next/server";
import { getSessionState, windowEnds } from "@/lib/session";
import { closeAllAtWindowEnd } from "@/lib/paper";
import { lastPrice } from "@/lib/marketData";

/** Scheduled in UTC for both EST and EDT (vercel.json); the route decides whether it's really window end in ET. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const due = windowEnds(now).some((t) => Math.abs(now.getTime() - t.getTime()) < 10 * 60_000);
  const closed = due ? await closeAllAtWindowEnd(lastPrice) : [];
  return NextResponse.json({ ok: true, due, closed: closed.map((t) => ({ ticker: t.ticker, exit: t.exit_price, pnl: t.pnl_usd })), session: getSessionState(now).phase });
}
