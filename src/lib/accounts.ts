import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { tradingDayStart } from "@/lib/sessions";
import type { Account } from "@prisma/client";

/** Looks up a client Account by its own webhookSecret — used to route an incoming
 * TradingView signal to this account instead of the primary one. Returns null for
 * both "no such account" and "no secret provided", same shape either way. */
export function findAccountBySecret(secret: string | null | undefined): Promise<Account | null> {
  if (!secret) return Promise.resolve(null);
  return prisma.account.findUnique({ where: { webhookSecret: secret } });
}

/**
 * Same idea as src/lib/risk.ts's updateEquityTracking, scoped to one Account instead
 * of the fleet-wide EngineState singleton. Call after every trade close belonging to
 * this account.
 */
export async function updateAccountEquityTracking(accountId: string): Promise<void> {
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

/** One account's current equity/peak/drawdown/profit, for its own position sizing. */
export async function getAccountRiskState(accountId: string): Promise<{
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
export async function accountTodaysRealizedPnl(accountId: string): Promise<number> {
  const start = tradingDayStart(DateTime.utc()).toJSDate();
  const agg = await prisma.trade.aggregate({
    _sum: { net: true },
    where: { accountId, closedAt: { gte: start } },
  });
  return Number(agg._sum.net ?? 0);
}
