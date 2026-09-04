import { NextRequest, NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/auth";
import { runRiskWatchdogCheck } from "@/lib/riskWatchdog";
import { advanceEconCalendarSync } from "@/lib/providers/apify-forexfactory";

/**
 * Once-daily heartbeat (Vercel Hobby plan caps crons at once/day — see vercel.json).
 * Two jobs share this slot rather than each getting a separate cron entry:
 *
 * 1. Risk watchdog fallback — the real-time trigger is the webhook's exit handler
 *    (runs on every trade close); this just guarantees a fresh status even on a day
 *    with zero trades.
 * 2. Econ calendar sync — advanceEconCalendarSync() was previously only ever called
 *    as a side effect of someone having the main dashboard open in a browser (it
 *    polls every 15s). If nobody has a tab open, that sync silently stalls and news
 *    blackout protection goes stale with no one knowing. This guarantees at least
 *    one server-driven refresh per day independent of any browser tab. Two calls
 *    back-to-back because the sync is a state machine (kick off a run, then check
 *    it) — the underlying Apify actor finishes in ~3s, so calling it twice in one
 *    invocation usually completes a full cycle instead of waiting until tomorrow's
 *    heartbeat to notice the run succeeded. Sleep kept short (3s, not the full ~3s+
 *    margin) to stay well under Vercel Hobby's 10s function cap — if the run hasn't
 *    finished yet, tomorrow's heartbeat (or the next dashboard page load) picks up
 *    the "running" state and finishes it then. Self-healing either way, just a
 *    possible extra day's lag in the worst case, never permanent staleness.
 */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRiskWatchdogCheck();

  await advanceEconCalendarSync().catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));
  await advanceEconCalendarSync().catch(() => {});

  return NextResponse.json({ ok: true, ...result });
}
