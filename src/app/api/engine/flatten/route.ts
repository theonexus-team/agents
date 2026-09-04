import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAccountKey, checkDeskKey } from "@/lib/auth";
import { computeClosePnl } from "@/lib/pnl";
import { getLiveQuotes } from "@/lib/providers/yahoo";
import type { InstrumentSymbol } from "@/lib/types";
import { updateEquityTracking } from "@/lib/risk";
import { updateAccountEquityTracking } from "@/lib/accounts";

/**
 * Manually closes one (or all) open positions at the current live price, scoped to
 * ONE account — the primary/legacy one (accountId null) when no accessToken is
 * given, or one client Account's own positions when it is. This only closes our own
 * dashboard-side tracking of the position — it has no way to reach back into the
 * TradingView indicator managing the same trade on the chart. If that indicator's
 * own target/stop later triggers for the same conceptual trade, its exit alert will
 * just find no matching open position here and no-op, which is expected.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deskKey, positionId, accessToken } = body as {
    deskKey?: string;
    positionId?: string;
    accessToken?: string;
  };

  let accountId: string | null = null;
  if (accessToken) {
    const account = await prisma.account.findUnique({ where: { accessToken } });
    if (!account) {
      return NextResponse.json({ error: "Unknown account" }, { status: 404 });
    }
    if (!checkAccountKey(deskKey, account.deskKey)) {
      return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
    }
    accountId = account.id;
  } else {
    if (!checkDeskKey(deskKey)) {
      return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
    }
  }

  // accountId is always applied — a positionId belonging to a different account
  // (e.g. a client guessing/reusing an id) simply won't match and is skipped below,
  // never flattened. Without this, "flatten all" from the primary dashboard would
  // also flatten every client account's positions, which would be a real bug now
  // that positions can belong to more than one account.
  const positions = await prisma.openPosition.findMany({
    where: positionId ? { id: positionId, accountId } : { accountId },
  });

  if (positions.length === 0) {
    return NextResponse.json({ ok: true, closed: [], note: "nothing open to flatten" });
  }

  // Live-execution positions (a real NinjaTrader position exists) can't be closed by
  // just marking the database row shut at a Yahoo quote — that would leave the REAL
  // position open and unmanaged in NinjaTrader while the dashboard shows it flat.
  // Queue a real exit intent instead, same as a Pine exit signal does, and let the
  // watcher do the actual flatten + report the real fill back.
  const livePositions = positions.filter((p) => p.liveExecution);
  const paperPositions = positions.filter((p) => !p.liveExecution);

  const closed: { positionId: string; symbol: string; net: number }[] = [];
  const queued: { positionId: string; symbol: string }[] = [];
  const skipped: { positionId: string; symbol: string; reason: string }[] = [];

  for (const position of livePositions) {
    const alreadyPendingExit = await prisma.executionIntent.findFirst({
      where: { action: "exit", instrumentSymbol: position.instrumentSymbol, processedAt: null },
    });
    if (alreadyPendingExit) {
      skipped.push({ positionId: position.id, symbol: position.instrumentSymbol, reason: "exit already queued for the watcher" });
      continue;
    }
    await prisma.executionIntent.create({
      data: {
        action: "exit",
        instrumentSymbol: position.instrumentSymbol,
        direction: position.direction,
        session: position.session,
        strategy: position.strategy,
        contracts: position.contracts,
        outcomeHint: "MANUAL_FLATTEN",
      },
    });
    queued.push({ positionId: position.id, symbol: position.instrumentSymbol });
  }

  const quotes = await getLiveQuotes(
    [...new Set(paperPositions.map((p) => p.instrumentSymbol as InstrumentSymbol))]
  );
  const quoteBySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  for (const position of paperPositions) {
    const quote = quoteBySymbol.get(position.instrumentSymbol as InstrumentSymbol);
    if (!quote) {
      skipped.push({
        positionId: position.id,
        symbol: position.instrumentSymbol,
        reason: "no live price available right now — try again shortly",
      });
      continue;
    }

    // Same atomic delete-first claim the webhook exit uses, in case a real TradingView
    // exit for this same position lands at the same moment.
    try {
      await prisma.openPosition.delete({ where: { id: position.id } });
    } catch {
      skipped.push({ positionId: position.id, symbol: position.instrumentSymbol, reason: "already closed" });
      continue;
    }

    const instrument = await prisma.instrument.findUnique({ where: { symbol: position.instrumentSymbol } });
    const { net, perDollarRisked } = computeClosePnl({
      direction: position.direction,
      entryPrice: Number(position.entryPrice),
      stopPrice: Number(position.stopPrice),
      exitPrice: quote.price,
      contracts: position.contracts,
      tickValue: instrument?.tickValue ? Number(instrument.tickValue) : null,
      tickSize: instrument?.tickSize ? Number(instrument.tickSize) : null,
      riskPerTrade: instrument?.riskPerTrade ?? 150,
    });

    await prisma.trade.create({
      data: {
        accountId: position.accountId,
        instrumentSymbol: position.instrumentSymbol,
        direction: position.direction,
        session: position.session,
        strategy: position.strategy,
        entryPrice: position.entryPrice,
        exitPrice: quote.price,
        openedAt: position.openedAt,
        closedAt: new Date(),
        outcome: "MANUAL_FLATTEN",
        contracts: position.contracts,
        worstPoint: Math.min(0, net),
        bestPoint: Math.max(0, net),
        net,
        perDollarRisked,
        includedInRuleset: true,
        liveExecution: false,
      },
    });

    closed.push({ positionId: position.id, symbol: position.instrumentSymbol, net });
  }

  if (closed.length > 0) {
    if (accountId) {
      await updateAccountEquityTracking(accountId);
    } else {
      await updateEquityTracking();
    }
  }

  return NextResponse.json({ ok: true, closed, queued, skipped });
}
