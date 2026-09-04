import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";

export const dynamic = "force-dynamic";

function winRateStats(rows: { net: Parameters<typeof num>[0] }[]) {
  const closed = rows.length;
  const wins = rows.filter((r) => num(r.net) > 0).length;
  const netProfit = rows.reduce((s, r) => s + num(r.net), 0);
  return {
    closedTrades: closed,
    wins,
    winRate: closed > 0 ? Math.round((wins / closed) * 1000) / 10 : null,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}

export async function GET() {
  const [state, tradesRaw, signals, allClosedRaw] = await Promise.all([
    prisma.kalshiEngineState.findUnique({ where: { id: "singleton" } }),
    prisma.kalshiTrade.findMany({ orderBy: { openedAt: "desc" }, take: 50 }),
    prisma.kalshiSignal.findMany({ orderBy: { occurredAt: "desc" }, take: 25 }),
    // Separate, uncapped fetch for stats - the trade log above is limited to the
    // most recent 50, which would silently skew win rate once volume grows past that.
    prisma.kalshiTrade.findMany({ where: { status: "closed" }, select: { net: true, strategy: true, isPaper: true } }),
  ]);

  // Paper and real are separate books - once the bot flips modes, the dashboard
  // should show a clean slate for the new mode, not history mixed with the other.
  const paperMode = state?.paperMode ?? true;
  const trades = tradesRaw.filter((t) => t.isPaper === paperMode);
  const allClosed = allClosedRaw.filter((t) => t.isPaper === paperMode);

  const closedToday = trades.filter(
    (t) => t.closedAt && t.closedAt >= new Date(new Date().setUTCHours(0, 0, 0, 0))
  );
  const dailyPnl = closedToday.reduce((s, t) => s + num(t.net), 0);
  const botLastSeen = state?.botLastSeen?.toISOString() ?? null;
  const online = botLastSeen ? Date.now() - new Date(botLastSeen).getTime() < 60_000 : false;

  const byStrategy: Record<string, ReturnType<typeof winRateStats>> = {};
  for (const strategy of new Set(allClosed.map((t) => t.strategy))) {
    byStrategy[strategy] = winRateStats(allClosed.filter((t) => t.strategy === strategy));
  }

  // Mirrors execution/sizing.py's scaled_stake_usd() exactly - paper and real P&L
  // compound as separate equity curves, matching whichever mode the bot itself
  // reports via its heartbeat.
  const startingBalance = num(state?.startingBalance ?? 10);
  const baseStake = num(state?.stakePerTrade ?? 12.5);
  const cumulativeNet = allClosed.reduce((s, t) => s + num(t.net), 0);
  // Real mode: trust the bot's own live-queried Kalshi balance (reported via
  // heartbeat) over recomputing it here, since a manual deposit/withdrawal
  // outside the bot is invisible to a startingBalance+cumulativeNet formula.
  // Paper mode has no real balance to query, so it keeps the virtual bookkeeping.
  // Floored at 0 either way - there's no margin/debt here.
  const equity = !paperMode && state?.lastKnownBalance != null
    ? Math.max(0, num(state.lastKnownBalance))
    : Math.max(0, startingBalance + cumulativeNet);
  const nextStake = Math.max(1, (baseStake / startingBalance) * equity);

  return NextResponse.json({
    status: {
      online,
      botLastSeen,
      paused: state?.paused ?? false,
      killSwitch: state?.killSwitch ?? false,
      killSwitchReason: state?.killSwitchReason ?? null,
      paperMode: state?.paperMode ?? true,
    },
    risk: {
      stakePerTrade: Math.round(nextStake * 100) / 100,
      baseStake,
      startingBalance,
      equity: Math.round(equity * 100) / 100,
      maxDailyLoss: num(state?.maxDailyLoss ?? 50),
      maxDailyProfit: num(state?.maxDailyProfit ?? 100),
      maxTradesPerDay: state?.maxTradesPerDay ?? 5,
      tradesToday: closedToday.length,
      dailyPnl: Math.round(dailyPnl * 100) / 100,
    },
    stats: {
      overall: winRateStats(allClosed),
      byStrategy,
    },
    openPosition: trades.find((t) => t.status === "open")
      ? (() => {
          const t = trades.find((tr) => tr.status === "open")!;
          return {
            id: t.id,
            ticker: t.ticker,
            side: t.side,
            entryPrice: num(t.entryPrice),
            stopPrice: num(t.stopPrice),
            targetPrice: num(t.targetPrice),
            contracts: t.contracts,
            windowCloseAt: t.windowCloseAt.toISOString(),
            openedAt: t.openedAt.toISOString(),
            isPaper: t.isPaper,
            strategy: t.strategy,
          };
        })()
      : null,
    tradeLog: trades.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      side: t.side,
      strikePrice: num(t.strikePrice),
      entryPrice: num(t.entryPrice),
      exitPrice: t.exitPrice !== null ? num(t.exitPrice) : null,
      contracts: t.contracts,
      status: t.status,
      outcome: t.outcome,
      net: t.net !== null ? num(t.net) : null,
      feesPaid: t.feesPaid !== null ? num(t.feesPaid) : null,
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt ? t.closedAt.toISOString() : null,
      isPaper: t.isPaper,
      strategy: t.strategy,
    })),
    signals: signals.map((s) => ({
      id: s.id,
      direction: s.direction,
      fired: s.fired,
      blockedReason: s.blockedReason,
      vwapValue: s.vwapValue !== null ? num(s.vwapValue) : null,
      orHigh: s.orHigh !== null ? num(s.orHigh) : null,
      orLow: s.orLow !== null ? num(s.orLow) : null,
      occurredAt: s.occurredAt.toISOString(),
      strategy: s.strategy,
    })),
  });
}
