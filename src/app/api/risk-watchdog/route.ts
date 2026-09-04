import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";
import { num } from "@/lib/serialize";
import { runRiskWatchdogCheck } from "@/lib/riskWatchdog";

/** How stale the econ calendar sync can get before it's flagged — generous margin
 * above the once-daily server-driven refresh cadence (see the risk-watchdog cron),
 * since a browser tab open elsewhere can also drive it more often. */
const CALENDAR_STALE_HOURS = 30;

/** Read-only access to the risk watchdog's latest status + recent alerts, plus the
 * econ calendar sync's health (previously only ever refreshed as a side effect of
 * someone having the main dashboard open — surfaced here so staleness is visible
 * instead of silent). Same desk-key-gated-on-reads pattern as /api/analyst-runs.
 *
 * Recomputes the risk status on every load (not just reading the stored row) —
 * found 2026-09-04 that the stored RiskWatchdogStatus can visibly lag reality: it
 * only updates on a trigger (trade close or the daily cron heartbeat), so a bug fix
 * or config change between triggers left stale numbers on the page until the next
 * one fired, which is exactly what happened here (a real accountId-scoping bug got
 * fixed in risk.ts, but the stored status kept showing the pre-fix drawdown for
 * hours until this was found and manually refreshed). The underlying arithmetic is
 * cheap (a couple of DB aggregates, no external API), unlike the econ calendar sync
 * below which stays opportunistic because it hits Apify's API — so there's no
 * reason not to just always compute fresh here instead of trusting a cached row. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  await runRiskWatchdogCheck().catch(() => {});

  const [status, alerts, calendarSync] = await Promise.all([
    prisma.riskWatchdogStatus.findUnique({ where: { id: "singleton" } }),
    prisma.riskWatchdogAlert.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.econCalendarSync.findUnique({ where: { id: "singleton" } }),
  ]);

  const staleHours = calendarSync?.lastSuccessAt
    ? (Date.now() - calendarSync.lastSuccessAt.getTime()) / 3_600_000
    : null;

  return NextResponse.json({
    status: status && {
      ...status,
      currentEquity: num(status.currentEquity),
      peakEquity: num(status.peakEquity),
      drawdownFromPeak: num(status.drawdownFromPeak),
      drawdownPct: num(status.drawdownPct),
      dailyPnl: num(status.dailyPnl),
      dailyLossPct: num(status.dailyLossPct),
    },
    alerts,
    econCalendar: {
      lastSuccessAt: calendarSync?.lastSuccessAt ?? null,
      syncStatus: calendarSync?.status ?? "unknown",
      staleHours,
      stale: staleHours === null || staleHours > CALENDAR_STALE_HOURS,
    },
  });
}
