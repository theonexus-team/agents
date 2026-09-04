import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAccountKey } from "@/lib/auth";
import { computeClosePnl } from "@/lib/pnl";
import { getLiveQuotes } from "@/lib/providers/yahoo";
import type { InstrumentSymbol } from "@/lib/types";
import { updateEquityTracking } from "@/lib/risk";

/**
 * Manually closes one (or all) of ONE ACCOUNT's open positions at the current live
 * price. This only closes our own dashboard-side tracking of the position — it has
 * no way to reach back into the TradingView indicator managing the same trade on the
 * chart. If that indicator's own target/stop later triggers for the same conceptual
 * trade, its exit alert will just find no matching open position here and no-op,
 * which is expected.
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

  if (!accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }
  const account = await prisma.account.findUnique({ where: { accessToken } });
  if (!account) {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  }
  if (!checkAccountKey(deskKey, account.deskKey)) {
    return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
  }

  // Always scoped to this account — a positionId belonging to a different account
  // (e.g. a client guessing/reusing an id) simply won't match and is skipped below,
  // never flattened.
  const positions = await prisma.openPosition.findMany({
    where: positionId ? { id: positionId, accountId: account.id } : { accountId: account.id },
  });

  if (positions.length === 0) {
    return NextResponse.json({ ok: true, closed: [], note: "nothing open to flatten" });
  }

  const quotes = await getLiveQuotes(
    [...new Set(positions.map((p) => p.instrumentSymbol as InstrumentSymbol))]
  );
  const quoteBySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  const closed: { positionId: string; symbol: string; net: number }[] = [];
  const skipped: { positionId: string; symbol: string; reason: string }[] = [];

  for (const position of positions) {
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
        accountId: account.id,
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
      },
    });

    closed.push({ positionId: position.id, symbol: position.instrumentSymbol, net });
  }

  if (closed.length > 0) {
    await updateEquityTracking(account.id);
  }

  return NextResponse.json({ ok: true, closed, skipped });
}
