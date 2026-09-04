import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { tradingDayStart } from "@/lib/sessions";

export const MAX_LOSS_FROM_PEAK = 2000;
export const MAX_DAILY_LOSS = 1000;

/**
 * Call after every trade close (webhook exit, manual flatten). Recomputes total
 * account equity from the full trade history, ratchets peakEquity up if a new high
 * was reached, and — the trailing-drawdown rule — flags maxLossBreached (and pauses
 * globally) the moment equity falls $2,000 below the highest peak ever reached.
 * Idempotent: recomputing from source data each time means it can't drift.
 */
export async function updateEquityTracking(): Promise<void> {
  const [engine, agg] = await Promise.all([
    prisma.engineState.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.trade.aggregate({ _sum: { net: true } }),
  ]);

  const startingBalance = Number(engine.startingBalance);
  const currentEquity = startingBalance + Number(agg._sum.net ?? 0);
  const peakEquity = Math.max(Number(engine.peakEquity), currentEquity);
  const justBreached = !engine.maxLossBreached && currentEquity <= peakEquity - MAX_LOSS_FROM_PEAK;

  await prisma.engineState.update({
    where: { id: "singleton" },
    data: {
      peakEquity,
      ...(justBreached ? { maxLossBreached: true, globalPaused: true } : {}),
    },
  });
}

/** Current equity, peak equity, drawdown-from-peak, and profit-from-start, for position sizing. */
export async function getCurrentRiskState(): Promise<{
  currentEquity: number;
  peakEquity: number;
  startingBalance: number;
  drawdownFromPeak: number;
  profitFromStart: number;
}> {
  const [engine, agg] = await Promise.all([
    prisma.engineState.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.trade.aggregate({ _sum: { net: true } }),
  ]);
  const startingBalance = Number(engine.startingBalance);
  const peakEquity = Number(engine.peakEquity);
  const currentEquity = startingBalance + Number(agg._sum.net ?? 0);
  return {
    currentEquity,
    peakEquity,
    startingBalance,
    drawdownFromPeak: Math.max(0, peakEquity - currentEquity),
    profitFromStart: Math.max(0, currentEquity - startingBalance),
  };
}

/** Realized net P&L within the current futures trading day (6pm ET to 5pm ET next day). */
export async function todaysRealizedPnl(): Promise<number> {
  const start = tradingDayStart(DateTime.utc()).toJSDate();
  const agg = await prisma.trade.aggregate({
    _sum: { net: true },
    where: { closedAt: { gte: start } },
  });
  return Number(agg._sum.net ?? 0);
}
