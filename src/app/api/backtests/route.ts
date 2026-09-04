import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";
import { computeStats } from "@/lib/stats";
import type { BacktestMode, InstrumentSymbol } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const strategy = searchParams.get("strategy");
  const instrument = searchParams.get("instrument");
  const mode = searchParams.get("mode");

  const where: Prisma.BacktestRunWhereInput = {};
  if (strategy) where.strategy = strategy;
  if (instrument) where.instrumentSymbol = instrument as InstrumentSymbol;
  if (mode) where.mode = mode as BacktestMode;

  const runs = await prisma.backtestRun.findMany({
    where,
    include: { trades: { select: { net: true, perDollarRisked: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    runs.map((r) => ({
      id: r.id,
      strategy: r.strategy,
      symbol: r.instrumentSymbol,
      timeframe: r.timeframe,
      mode: r.mode,
      status: r.status,
      dataStart: r.dataStart.toISOString(),
      dataEnd: r.dataEnd.toISOString(),
      sourceNote: r.sourceNote,
      parameters: r.parameters,
      createdAt: r.createdAt.toISOString(),
      stats: computeStats(r.trades.map((t) => ({ net: num(t.net), perDollarRisked: num(t.perDollarRisked) }))),
      tradeCount: r.trades.length,
    }))
  );
}
