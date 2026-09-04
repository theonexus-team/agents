import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/portfolios/[id]">) {
  const { id } = await params;

  const portfolio = await prisma.portfolioRun.findUnique({
    where: { id },
    include: { legs: { include: { trades: true } } },
  });

  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio run not found." }, { status: 404 });
  }

  const allTrades = portfolio.legs
    .flatMap((leg) =>
      leg.trades.map((t) => ({
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
      }))
    )
    .sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));

  const startingBalance = num(portfolio.startingBalance);
  let equity = startingBalance;
  const equityCurve = allTrades.map((t) => {
    equity += t.net;
    return { closedAt: t.closedAt, equity };
  });

  let peak = startingBalance;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    maxDrawdown = Math.max(maxDrawdown, peak - point.equity);
  }

  const legs = portfolio.legs.map((leg) => ({
    runId: leg.id,
    strategy: leg.strategy,
    symbol: leg.instrumentSymbol,
    stats: computeStats(leg.trades.map((t) => ({ net: num(t.net), perDollarRisked: num(t.perDollarRisked) }))),
  }));

  return NextResponse.json({
    id: portfolio.id,
    label: portfolio.label,
    startingBalance,
    maxLossFromPeak: num(portfolio.maxLossFromPeak),
    sizingMode: portfolio.sizingMode,
    sourceNote: portfolio.sourceNote,
    status: portfolio.status,
    createdAt: portfolio.createdAt.toISOString(),
    legCount: legs.length,
    totalTrades: allTrades.length,
    totalNet: allTrades.reduce((sum, t) => sum + t.net, 0),
    maxDrawdown,
    legs,
    equityCurve,
    trades: [...allTrades].reverse(), // newest-first, matching TradeLogTable convention
  });
}
