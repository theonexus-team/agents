import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { tradingDayStart } from "@/lib/sessions";

export const MAX_LOSS_FROM_PEAK = 2000;
export const MAX_DAILY_LOSS = 1000;

/**
 * Everything in this file is the PRIMARY/LEGACY account's own risk state
 * (accountId: null) — see src/lib/accounts.ts for the parallel per-client-account
 * versions (getAccountRiskState, accountTodaysRealizedPnl, updateAccountEquityTracking).
 *
 * Bug fixed 2026-09-04: all three `prisma.trade.aggregate` calls below were missing
 * `where: { accountId: null }` entirely — they were summing net P&L across the
 * primary account AND every client account combined, not just the primary account.
 * Confirmed against accounts.ts's equivalents (which all correctly scope by
 * accountId) that this was always meant to be primary-only. Real consequences, not
 * just a display bug: getCurrentRiskState() feeds the legacy webhook's contract
 * scaling and updateEquityTracking()'s maxLossBreached/trailing-drawdown detection,
 * and todaysRealizedPnl() feeds the legacy daily-loss-limit gate — so the primary
 * account's position sizing and both circuit breakers had been silently influenced
 * by Client/Client 2's P&L this whole time. Caught because the equity shown on
 * /risk-watchdog (built same day, same underlying bug) didn't match the main
 * dashboard's correctly-scoped number.
 */

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
    prisma.trade.aggregate({ _sum: { net: true }, where: { accountId: null } }),
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
    prisma.trade.aggregate({ _sum: { net: true }, where: { accountId: null } }),
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
    where: { accountId: null, closedAt: { gte: start } },
  });
  return Number(agg._sum.net ?? 0);
}
