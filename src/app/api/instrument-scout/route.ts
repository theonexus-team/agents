import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";
import { num } from "@/lib/serialize";

const SOURCE_NOTE = "Instrument Scout";

/** Read-only access to Instrument Scout backtest results — same desk-key-gated-on-
 * reads pattern as the other private pages. Computed here rather than stored
 * pre-aggregated: BacktestRun/BacktestTrade already hold the raw data (written by
 * backtest/scout.py, a local script — see that file for why this can't be a cloud
 * cron like the other agents), this just summarizes per run. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const runs = await prisma.backtestRun.findMany({
    where: { sourceNote: SOURCE_NOTE },
    orderBy: { createdAt: "desc" },
    include: { trades: { orderBy: { closedAt: "asc" } } },
  });

  const results = runs.map((run) => {
    let cum = 0,
      peak = 0,
      maxDD = 0,
      wins = 0;
    for (const t of run.trades) {
      const n = num(t.net);
      cum += n;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
      if (n > 0) wins++;
    }
    return {
      id: run.id,
      strategy: run.strategy,
      instrumentSymbol: run.instrumentSymbol,
      timeframe: run.timeframe,
      dataStart: run.dataStart,
      dataEnd: run.dataEnd,
      createdAt: run.createdAt,
      trades: run.trades.length,
      winRate: run.trades.length ? (100 * wins) / run.trades.length : 0,
      net: cum,
      maxDrawdown: maxDD,
    };
  });

  results.sort((a, b) => b.net - a.net);

  return NextResponse.json({ results });
}
