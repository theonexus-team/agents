import { NextRequest, NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/auth";
import { runRiskWatchdogCheck } from "@/lib/riskWatchdog";
import { syncEconCalendarFromFinnhub } from "@/lib/providers/finnhub";

/**
 * Once-daily heartbeat (Vercel Hobby plan caps crons at once/day — see vercel.json).
 * Two jobs share this slot rather than each getting a separate cron entry:
 *
 * 1. Risk watchdog fallback — the real-time trigger is the webhook's exit handler
 *    (runs on every trade close); this just guarantees a fresh status even on a day
 *    with zero trades.
 * 2. Econ calendar sync — previously only ever advanced as a side effect of someone
 *    having the main dashboard open (it polled every 15s). If nobody had a tab open,
 *    news blackout protection went stale with no one knowing — confirmed live it
 *    actually had (3+ days stale). Also previously sourced from Apify scraping
 *    ForexFactory, which hit its own monthly usage hard limit — see finnhub.ts for
 *    why this now pulls from Finnhub's actual API instead. One plain synchronous
 *    call, no async run-then-poll dance needed like the old Apify path required.
 */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRiskWatchdogCheck();
  await syncEconCalendarFromFinnhub().catch(() => {});

  return NextResponse.json({ ok: true, ...result });
}
