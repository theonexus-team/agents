import { prisma } from "@/lib/prisma";
import { MAX_DAILY_LOSS, MAX_LOSS_FROM_PEAK, getCurrentRiskState, todaysRealizedPnl } from "@/lib/risk";
import { sendPushToAll } from "@/lib/push";
import { postToBoard } from "@/lib/agentBoard";

/**
 * Core risk-watchdog check, shared by two triggers:
 *  - the webhook's exit handler, right after every trade close (equity/drawdown can
 *    only change when a trade closes — this app tracks realized P&L only, no live
 *    mark-to-market — so checking on close is exactly when it matters, not a poll)
 *  - a once-daily Vercel Cron heartbeat (see /api/cron/risk-watchdog), so a quiet day
 *    with zero trades still gets one fresh status instead of going stale forever
 * Pure arithmetic against the SAME limits the webhook already enforces — no LLM call,
 * nothing here needs reasoning.
 */
const WARNING_THRESHOLD = 0.7;

export async function runRiskWatchdogCheck(): Promise<{ level: "OK" | "WARNING" | "BREACH" }> {
  const [risk, dailyPnl, prevStatus] = await Promise.all([
    getCurrentRiskState(),
    todaysRealizedPnl(),
    prisma.riskWatchdogStatus.findUnique({ where: { id: "singleton" } }),
  ]);

  const drawdownPct = (risk.drawdownFromPeak / MAX_LOSS_FROM_PEAK) * 100;
  const dailyLossPct = dailyPnl < 0 ? (Math.abs(dailyPnl) / MAX_DAILY_LOSS) * 100 : 0;
  const worstPct = Math.max(drawdownPct, dailyLossPct);

  let level: "OK" | "WARNING" | "BREACH";
  if (worstPct >= 100) level = "BREACH";
  else if (worstPct >= WARNING_THRESHOLD * 100) level = "WARNING";
  else level = "OK";

  const summary = `drawdown $${risk.drawdownFromPeak.toFixed(2)} of $${MAX_LOSS_FROM_PEAK} (${drawdownPct.toFixed(0)}%), daily P&L $${dailyPnl.toFixed(2)} vs $${MAX_DAILY_LOSS} limit (${dailyLossPct.toFixed(0)}%).`;
  const message =
    level === "OK" ? `Within limits — ${summary}` : level === "WARNING" ? `Approaching a limit — ${summary}` : `LIMIT BREACHED — ${summary}`;

  await prisma.riskWatchdogStatus.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      currentEquity: risk.currentEquity,
      peakEquity: risk.peakEquity,
      drawdownFromPeak: risk.drawdownFromPeak,
      drawdownPct,
      dailyPnl,
      dailyLossPct,
      level,
      message,
    },
    update: {
      checkedAt: new Date(),
      currentEquity: risk.currentEquity,
      peakEquity: risk.peakEquity,
      drawdownFromPeak: risk.drawdownFromPeak,
      drawdownPct,
      dailyPnl,
      dailyLossPct,
      level,
      message,
    },
  });

  if (level !== (prevStatus?.level ?? "OK")) {
    await prisma.riskWatchdogAlert.create({ data: { level, message } });
    await postToBoard("risk-watchdog", `Level changed to ${level} — ${message}`, "/risk-watchdog").catch(() => {});
    // Only push on a change TOWARD worse, not on a recovery back to OK — a "you're
    // fine now" notification isn't worth interrupting someone for.
    if (level !== "OK") {
      await sendPushToAll(`Risk Watchdog: ${level}`, message, "/risk-watchdog").catch(() => {});
    }
  }

  return { level };
}
