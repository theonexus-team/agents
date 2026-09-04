import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** How stale the econ calendar sync can get before it's flagged — generous margin
 * above the once-daily server-driven refresh cadence (see the risk-watchdog cron),
 * since a browser tab open elsewhere can also drive it more often. */
const CALENDAR_STALE_HOURS = 30;

/** Read-only access to the risk watchdog's latest status + recent alerts, plus the
 * econ calendar sync's health (previously only ever refreshed as a side effect of
 * someone having the main dashboard open — surfaced here so staleness is visible
 * instead of silent). Same desk-key-gated-on-reads pattern as /api/analyst-runs. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const [status, alerts, calendarSync] = await Promise.all([
    prisma.riskWatchdogStatus.findUnique({ where: { id: "singleton" } }),
    prisma.riskWatchdogAlert.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.econCalendarSync.findUnique({ where: { id: "singleton" } }),
  ]);

  const staleHours = calendarSync?.lastSuccessAt
    ? (Date.now() - calendarSync.lastSuccessAt.getTime()) / 3_600_000
    : null;

  return NextResponse.json({
    status,
    alerts,
    econCalendar: {
      lastSuccessAt: calendarSync?.lastSuccessAt ?? null,
      syncStatus: calendarSync?.status ?? "unknown",
      staleHours,
      stale: staleHours === null || staleHours > CALENDAR_STALE_HOURS,
    },
  });
}
