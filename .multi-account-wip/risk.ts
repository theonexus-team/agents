import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { tradingDayStart } from "@/lib/sessions";

/**
 * Call after every trade close (webhook exit, manual flatten), for the account that
 * trade belongs to. Recomputes that account's total equity from its own trade
 * history, ratchets its peakEquity up if a new high was reached, and — the trailing-
 * drawdown rule — flags maxLossBreached (and pauses that account) the moment equity
 * falls maxLossFromPeak below the highest peak that account has ever reached.
 * Idempotent: recomputing from source data each time means it can't drift.
 */
export async function updateEquityTracking(accountId: string): Promise<void> {
  const [account, agg] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    prisma.trade.aggregate({ _sum: { net: true }, where: { accountId } }),
  ]);

  const startingBalance = Number(account.startingBalance);
  const currentEquity = startingBalance + Number(agg._sum.net ?? 0);
  const peakEquity = Math.max(Number(account.peakEquity), currentEquity);
  const maxLossFromPeak = Number(account.maxLossFromPeak);
  const justBreached = !account.maxLossBreached && currentEquity <= peakEquity - maxLossFromPeak;

  await prisma.account.update({
    where: { id: accountId },
    data: {
      peakEquity,
      ...(justBreached ? { maxLossBreached: true, globalPaused: true } : {}),
    },
  });
}

/** Current equity, peak equity, drawdown-from-peak, and profit-from-start, for one account's position sizing. */
export async function getCurrentRiskState(accountId: string): Promise<{
  currentEquity: number;
  peakEquity: number;
  startingBalance: number;
  maxLossFromPeak: number;
  drawdownFromPeak: number;
  profitFromStart: number;
}> {
  const [account, agg] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    prisma.trade.aggregate({ _sum: { net: true }, where: { accountId } }),
  ]);
  const startingBalance = Number(account.startingBalance);
  const peakEquity = Number(account.peakEquity);
  const maxLossFromPeak = Number(account.maxLossFromPeak);
  const currentEquity = startingBalance + Number(agg._sum.net ?? 0);
  return {
    currentEquity,
    peakEquity,
    startingBalance,
    maxLossFromPeak,
    drawdownFromPeak: Math.max(0, peakEquity - currentEquity),
    profitFromStart: Math.max(0, currentEquity - startingBalance),
  };
}

/** One account's realized net P&L within the current futures trading day (6pm ET to 5pm ET next day). */
export async function todaysRealizedPnl(accountId: string): Promise<number> {
  const start = tradingDayStart(DateTime.utc()).toJSDate();
  const agg = await prisma.trade.aggregate({
    _sum: { net: true },
    where: { accountId, closedAt: { gte: start } },
  });
  return Number(agg._sum.net ?? 0);
}
