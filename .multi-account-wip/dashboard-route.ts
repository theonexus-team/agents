import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";
import { computeStats, peakBalance } from "@/lib/stats";
import { allNextOpens } from "@/lib/sessions";
import { advanceEconCalendarSync } from "@/lib/providers/apify-forexfactory";
import { getLiveQuotes } from "@/lib/providers/yahoo";
import type { InstrumentSymbol as InstrumentSymbolT } from "@/lib/types";
import { getCurrentRiskState, todaysRealizedPnl } from "@/lib/risk";
import { computeScaledContracts } from "@/lib/positionSizing";

export const dynamic = "force-dynamic";

async function resolveEconEvents() {
  // Opportunistically kick off / poll the async Apify scrape (fast, never blocks —
  // see advanceEconCalendarSync for why this can't run inline). Always serve
  // whatever's in the DB regardless of outcome, so a slow/failed scrape never
  // breaks the dashboard.
  await advanceEconCalendarSync().catch(() => {});

  const rows = await prisma.economicEvent.findMany({
    where: { releaseAt: { gte: new Date(), lte: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
    orderBy: { releaseAt: "asc" },
  });
  return rows.map((e) => ({
    title: e.title,
    country: e.country,
    releaseAt: e.releaseAt.toISOString(),
    tagged: e.tagged,
  }));
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("account");
  const account = token
    ? await prisma.account.findUnique({ where: { accessToken: token } })
    : await prisma.account.findFirst({ where: { isPrimary: true } });

  if (!account) {
    return NextResponse.json({ error: token ? "Unknown account" : "No primary account configured" }, { status: 404 });
  }

  const [engineState, instruments, trades, priceHealth, econEvents, openPositions, signals, dailyPnl, riskState] =
    await Promise.all([
      prisma.engineState.findUnique({ where: { id: "singleton" } }),
      prisma.instrument.findMany(),
      prisma.trade.findMany({ where: { accountId: account.id }, orderBy: { openedAt: "asc" } }),
      prisma.priceHealth.findMany(),
      resolveEconEvents(),
      prisma.openPosition.findMany({ where: { accountId: account.id }, orderBy: { openedAt: "desc" } }),
      prisma.signal.findMany({ where: { accountId: account.id }, orderBy: { occurredAt: "desc" }, take: 25 }),
      todaysRealizedPnl(account.id),
      getCurrentRiskState(account.id),
    ]);

  const startingBalance = num(account.startingBalance);

  const flatTrades = trades.map((t) => ({
    id: t.id,
    symbol: t.instrumentSymbol,
    direction: t.direction,
    session: t.session,
    strategy: t.strategy,
    entryPrice: num(t.entryPrice),
    exitPrice: num(t.exitPrice),
    openedAt: t.openedAt.toISOString(),
    closedAt: t.closedAt.toISOString(),
    outcome: t.outcome,
    worstPoint: num(t.worstPoint),
    bestPoint: num(t.bestPoint),
    net: num(t.net),
    perDollarRisked: num(t.perDollarRisked),
    contracts: t.contracts,
    includedInRuleset: t.includedInRuleset,
  }));

  const tradeableSymbols = new Set(instruments.filter((i) => i.tradeable).map((i) => i.symbol));

  const includedTrades = flatTrades.filter((t) => t.includedInRuleset);
  const tradeableTrades = includedTrades.filter((t) => tradeableSymbols.has(t.symbol as never));
  const goldOnlyTrades = includedTrades.filter((t) => t.symbol === "MGC");
  const hiddenTrades = flatTrades.filter((t) => !t.includedInRuleset);

  const tradeableStats = computeStats(tradeableTrades);
  const fullStats = computeStats(includedTrades);

  const currentBalance = startingBalance + tradeableStats.netProfit;
  const bestTradeableEver = peakBalance(startingBalance, tradeableTrades);
  const bestGoldOnlyEver = peakBalance(startingBalance, goldOnlyTrades);
  const bestFullEver = peakBalance(startingBalance, includedTrades);

  const perInstrument = instruments.map((ins) => {
    const t = includedTrades.filter((tr) => tr.symbol === ins.symbol);
    const stats = computeStats(t);
    return {
      symbol: ins.symbol,
      name: ins.name,
      research: ins.research,
      netProfit: stats.netProfit,
      trades: stats.closedTrades,
    };
  });

  const deploymentPlan = instruments
    .filter((ins) => ins.tradeable)
    .map((ins) => {
      const liveTrades = includedTrades.filter((tr) => tr.symbol === ins.symbol);
      const stats = computeStats(liveTrades);
      const scalingFactor = (ins.riskPerTrade * ins.currentAccounts) / ins.baseUnitRisk;
      return {
        symbol: ins.symbol,
        name: ins.name,
        market: ins.market,
        deployed: ins.deployed,
        riskPerTrade: ins.riskPerTrade,
        minAccounts: ins.minAccounts,
        maxAccounts: ins.maxAccounts,
        currentAccounts: ins.currentAccounts,
        liveTradesToward: ins.liveTradesToward,
        gateTarget: ins.gateTarget,
        liveStats: stats,
        rescaledNet: Math.round(stats.netProfit * scalingFactor),
      };
    });

  const liveQuotes = await getLiveQuotes(instruments.map((i) => i.symbol as InstrumentSymbolT)).catch(
    () => []
  );
  const liveQuoteBySymbol = new Map(liveQuotes.map((q) => [q.symbol, q]));

  const priceHealthOut = priceHealth.map((p) => {
    const live = liveQuoteBySymbol.get(p.instrumentSymbol as InstrumentSymbolT);
    if (live) {
      return {
        symbol: p.instrumentSymbol,
        lastPrice: live.price,
        minutesAgo: Math.max(0, Math.round((Date.now() - new Date(live.quotedAt).getTime()) / 60000)),
        crossCheckOk: true,
      };
    }
    return {
      symbol: p.instrumentSymbol,
      lastPrice: num(p.lastPrice),
      minutesAgo: Math.max(0, Math.round((Date.now() - p.lastUpdatedAt.getTime()) / 60000)),
      crossCheckOk: p.crossCheckOk,
    };
  });

  return NextResponse.json({
    account: { name: account.name, accessToken: account.accessToken, isPrimary: account.isPrimary },
    status: {
      reporterLastSeen: engineState?.reporterLastSeen?.toISOString() ?? null,
      globalPaused: account.globalPaused,
      mode: "paper trading",
    },
    risk: {
      peakEquity: num(account.peakEquity),
      maxLossBreached: account.maxLossBreached,
      maxLossFromPeak: num(account.maxLossFromPeak),
      dailyPnl: Math.round(dailyPnl * 100) / 100,
      dailyLossLimit: num(account.dailyLossLimit),
      dailyLossHit: dailyPnl <= -num(account.dailyLossLimit),
      scaledMicroContracts: computeScaledContracts(
        riskState.drawdownFromPeak,
        riskState.profitFromStart,
        riskState.maxLossFromPeak
      ),
    },
    startingBalance,
    balance: {
      current: Math.round(currentBalance),
      startedAt: startingBalance,
      changeAbs: Math.round(tradeableStats.netProfit),
      changePct:
        startingBalance > 0 ? Math.round((tradeableStats.netProfit / startingBalance) * 1000) / 10 : 0,
    },
    bestEver: {
      tradeableSet: Math.round(bestTradeableEver),
      goldOnly: Math.round(bestGoldOnlyEver),
      full: Math.round(bestFullEver),
    },
    sessions: allNextOpens(),
    stats: { tradeable: tradeableStats, full: fullStats },
    hiddenSummary: {
      count: hiddenTrades.length,
      winners: {
        count: hiddenTrades.filter((t) => t.net > 0).length,
        amount: Math.round(hiddenTrades.filter((t) => t.net > 0).reduce((s, t) => s + t.net, 0)),
      },
      losers: {
        count: hiddenTrades.filter((t) => t.net <= 0).length,
        amount: Math.round(hiddenTrades.filter((t) => t.net <= 0).reduce((s, t) => s + Math.abs(t.net), 0)),
      },
    },
    perInstrument,
    deploymentPlan,
    priceHealth: priceHealthOut,
    econEvents: econEvents.map((e) => ({
      id: `${e.country}-${e.title}-${e.releaseAt}`,
      title: e.title,
      country: e.country,
      releaseAt: e.releaseAt,
      tagged: e.tagged,
    })),
    openPositions: openPositions.map((p) => ({
      id: p.id,
      symbol: p.instrumentSymbol,
      direction: p.direction,
      session: p.session,
      strategy: p.strategy,
      entryPrice: num(p.entryPrice),
      stopPrice: num(p.stopPrice),
      targetPrice: num(p.targetPrice),
      openedAt: p.openedAt.toISOString(),
    })),
    signals: signals.map((s) => ({
      id: s.id,
      symbol: s.instrumentSymbol,
      direction: s.direction,
      session: s.session,
      strategy: s.strategy,
      entryPrice: num(s.entryPrice),
      stopPrice: num(s.stopPrice),
      targetPrice: num(s.targetPrice),
      occurredAt: s.occurredAt.toISOString(),
    })),
    tradeLog: [...flatTrades].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1)),
    instruments: instruments.map((i) => ({
      symbol: i.symbol,
      name: i.name,
      paused: i.paused,
      tradeable: i.tradeable,
      research: i.research,
    })),
  });
}
