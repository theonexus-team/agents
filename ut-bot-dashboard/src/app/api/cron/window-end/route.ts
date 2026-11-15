import { NextResponse } from "next/server";
import { getSessionState, windowEnds } from "@/lib/session";

/** Scheduled in UTC for both EST and EDT; the route itself decides whether it's really window end in ET. */
export function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const due = windowEnds(now).some((t) => Math.abs(now.getTime() - t.getTime()) < 10 * 60_000);
  // TODO(paper engine): when due, close open positions at the last Yahoo price with reason window_end.
  return NextResponse.json({ ok: true, due, session: getSessionState(now).phase, connected: false });
}
