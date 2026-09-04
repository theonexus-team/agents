import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";
import type { BacktestMode, InstrumentSymbol } from "@/lib/types";

//: Must match backtest/strategies/__init__.py's STRATEGIES dict — there's no shared
//: source of truth across the two languages, so keep these two lists in sync by hand
//: when a new strategy gets registered.
const VALID_STRATEGIES = ["orb_vwap", "algo2_first_touch"];
const VALID_SYMBOLS = ["MGC", "HG", "MNQ"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deskKey, strategy, symbol, timeframe, dateFrom, dateTo, params, mode, sourceNote } = body as {
    deskKey?: string;
    strategy?: string;
    symbol?: string;
    timeframe?: string;
    dateFrom?: string;
    dateTo?: string;
    params?: Record<string, unknown>;
    mode?: BacktestMode;
    sourceNote?: string;
  };

  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
  }
  if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: `strategy must be one of ${VALID_STRATEGIES.join(", ")}` }, { status: 400 });
  }
  if (!symbol || !VALID_SYMBOLS.includes(symbol)) {
    return NextResponse.json({ error: `symbol must be one of ${VALID_SYMBOLS.join(", ")}` }, { status: 400 });
  }
  const dataStart = dateFrom ? new Date(dateFrom) : null;
  const dataEnd = dateTo ? new Date(dateTo) : null;
  if (!dataStart || Number.isNaN(dataStart.getTime()) || !dataEnd || Number.isNaN(dataEnd.getTime())) {
    return NextResponse.json({ error: "dateFrom/dateTo must be valid dates" }, { status: 400 });
  }

  // This row IS the run request — the local worker (backtest/worker.py, picked up
  // by the theonexus-backtest-worker scheduled task) polls for status="queued",
  // executes it, and updates this same row with the real trades + status
  // "completed"/"failed" rather than creating a separate row. No new schema needed:
  // BacktestRun already has every field a request needs.
  const run = await prisma.backtestRun.create({
    data: {
      strategy,
      instrumentSymbol: symbol as InstrumentSymbol,
      timeframe: timeframe || "1m",
      mode: (mode as BacktestMode) || "HISTORICAL",
      dataStart,
      dataEnd,
      parameters: (params as object) || {},
      sourceNote: sourceNote || null,
      status: "queued",
    },
  });

  return NextResponse.json({ ok: true, id: run.id, status: run.status });
}
