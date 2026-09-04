import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/backtests/[runId]">) {
  const { runId } = await params;

  const run = await prisma.backtestRun.findUnique({
    where: { id: runId },
    include: { trades: { orderBy: { closedAt: "desc" } } },
  });

  if (!run) {
    return NextResponse.json({ error: "Backtest run not found." }, { status: 404 });
  }

  const trades = run.trades.map((t) => ({
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

  return NextResponse.json({
    id: run.id,
    strategy: run.strategy,
    symbol: run.instrumentSymbol,
    timeframe: run.timeframe,
    mode: run.mode,
    status: run.status,
    dataStart: run.dataStart.toISOString(),
    dataEnd: run.dataEnd.toISOString(),
    sourceNote: run.sourceNote,
    parameters: run.parameters,
    createdAt: run.createdAt.toISOString(),
    startingBalance: num(run.startingBalance),
    stats: computeStats(trades.map((t) => ({ net: t.net, perDollarRisked: t.perDollarRisked }))),
    tradeCount: trades.length,
    trades,
  });
}
