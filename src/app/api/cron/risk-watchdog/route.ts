import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronSecret } from "@/lib/auth";
import { MAX_DAILY_LOSS, MAX_LOSS_FROM_PEAK, getCurrentRiskState, todaysRealizedPnl } from "@/lib/risk";

/**
 * Risk watchdog — separate pipeline from trading-analyst (see the "one page per
 * pipeline, not per role" rule), because this isn't part of that three-role
 * conversation: it's an independent, frequent, no-LLM check against the primary
 * account's real risk limits. Vercel Cron-triggered (see vercel.json), runs entirely
 * in the cloud. Pure arithmetic, deliberately no LLM call — nothing here needs
 * reasoning, just a threshold comparison that has to be cheap enough to run often
 * and reliable enough not to hallucinate a number.
 *
 * Writes the latest result to RiskWatchdogStatus (a singleton, overwritten every
 * run) and appends to RiskWatchdogAlert only when the level actually CHANGES, so a
 * sustained WARNING doesn't spam a new row every 15 minutes.
 */
const WARNING_THRESHOLD = 0.7;

export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const message =
    level === "OK"
      ? `Within limits — drawdown $${risk.drawdownFromPeak.toFixed(2)} of $${MAX_LOSS_FROM_PEAK} (${drawdownPct.toFixed(0)}%), daily P&L $${dailyPnl.toFixed(2)} vs $${MAX_DAILY_LOSS} limit (${dailyLossPct.toFixed(0)}%).`
      : level === "WARNING"
        ? `Approaching a limit — drawdown $${risk.drawdownFromPeak.toFixed(2)} of $${MAX_LOSS_FROM_PEAK} (${drawdownPct.toFixed(0)}%), daily P&L $${dailyPnl.toFixed(2)} vs $${MAX_DAILY_LOSS} limit (${dailyLossPct.toFixed(0)}%).`
        : `LIMIT BREACHED — drawdown $${risk.drawdownFromPeak.toFixed(2)} of $${MAX_LOSS_FROM_PEAK} (${drawdownPct.toFixed(0)}%), daily P&L $${dailyPnl.toFixed(2)} vs $${MAX_DAILY_LOSS} limit (${dailyLossPct.toFixed(0)}%).`;

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
  }

  return NextResponse.json({ ok: true, level, drawdownPct, dailyLossPct });
}
