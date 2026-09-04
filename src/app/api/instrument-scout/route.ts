import { NextRequest, NextResponse } from "next/server";
import type { Decimal } from "@prisma/client-runtime-utils";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";
import { num } from "@/lib/serialize";

const SOURCE_NOTE = "Instrument Scout";

function stats(trades: { net: Decimal }[]) {
  let cum = 0,
    peak = 0,
    maxDD = 0,
    wins = 0;
  for (const t of trades) {
    const n = num(t.net);
    cum += n;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
    if (n > 0) wins++;
  }
  return { trades: trades.length, winRate: trades.length ? (100 * wins) / trades.length : 0, net: cum, maxDrawdown: maxDD };
}

/** Read-only access to Instrument Scout backtest results — same desk-key-gated-on-
 * reads pattern as the other private pages. Computed here rather than stored
 * pre-aggregated: BacktestRun/BacktestTrade already hold the raw data (written by
 * backtest/scout.py, a local script — see that file for why this can't be a cloud
 * cron like the other agents). Broken out by session, not just by run as a whole —
 * matches how every other performance breakdown in this app works (instrument +
 * strategy + session), and a strategy that's flat overall can still be strong in
 * one session and dead in another, same as what's already been found on the live
 * account. */
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

  const bySession: {
    runId: string;
    strategy: string;
    instrumentSymbol: string;
    timeframe: string;
    session: string;
    dataStart: Date;
    dataEnd: Date;
    trades: number;
    winRate: number;
    net: number;
    maxDrawdown: number;
  }[] = [];

  const overall = runs.map((run) => {
    const sessions = [...new Set(run.trades.map((t) => t.session))];
    for (const session of sessions) {
      const sessionTrades = run.trades.filter((t) => t.session === session);
      bySession.push({
        runId: run.id,
        strategy: run.strategy,
        instrumentSymbol: run.instrumentSymbol,
        timeframe: run.timeframe,
        session,
        dataStart: run.dataStart,
        dataEnd: run.dataEnd,
        ...stats(sessionTrades),
      });
    }
    return {
      id: run.id,
      strategy: run.strategy,
      instrumentSymbol: run.instrumentSymbol,
      timeframe: run.timeframe,
      dataStart: run.dataStart,
      dataEnd: run.dataEnd,
      createdAt: run.createdAt,
      ...stats(run.trades),
    };
  });

  overall.sort((a, b) => b.net - a.net);
  bySession.sort((a, b) => b.net - a.net);

  return NextResponse.json({ overall, bySession });
}
