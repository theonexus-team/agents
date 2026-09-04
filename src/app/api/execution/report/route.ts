import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkExecutionSecret } from "@/lib/auth";
import { z } from "zod";
import { computeClosePnl } from "@/lib/pnl";
import { updateEquityTracking } from "@/lib/risk";

const OUTCOMES = ["HIT_TARGET", "STOPPED_OUT", "STOPPED_OUT_TARGET_HIT_LATER", "CLOSED_AT_DAY_END", "MANUAL_FLATTEN"] as const;

const reportSchema = z.object({
  secret: z.string(),
  intentId: z.string(),
  fillPrice: z.number(),
  outcome: z.enum(OUTCOMES).optional(),
});

/**
 * Reported by the local NinjaTrader watcher (see ninjatrader-executor/) once an
 * ExecutionIntent it claimed from /api/execution/pending actually fills in
 * NinjaTrader. THIS is what creates/closes the primary dashboard's real
 * OpenPosition/Trade rows when EngineState.liveExecutionMode is on — everything
 * here uses the REAL fill price the watcher observed, never Pine's calculated one.
 * All the metadata (direction/session/strategy/stopPrice/targetPrice/contracts)
 * comes from the ExecutionIntent row itself, not from this request body, so a
 * mismatched or spoofed report can't attach the wrong metadata to a real fill.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  if (!checkExecutionSecret(d.secret)) {
    return NextResponse.json({ error: "Invalid execution secret" }, { status: 401 });
  }

  const intent = await prisma.executionIntent.findUnique({ where: { id: d.intentId } });
  if (!intent) {
    return NextResponse.json({ error: "Unknown intentId" }, { status: 404 });
  }
  if (intent.processedAt) {
    // Idempotent: a retried report for an intent already processed is a no-op, not
    // an error — the watcher may legitimately retry a report that timed out on its
    // end after actually succeeding here.
    return NextResponse.json({ ok: true, note: "already processed" });
  }

  if (intent.action === "entry") {
    const position = await prisma.openPosition.create({
      data: {
        accountId: null,
        instrumentSymbol: intent.instrumentSymbol,
        direction: intent.direction!,
        session: intent.session!,
        strategy: intent.strategy ?? "1m ORB + VWAP",
        entryPrice: d.fillPrice,
        stopPrice: intent.stopPrice ?? d.fillPrice,
        targetPrice: intent.targetPrice ?? d.fillPrice,
        contracts: intent.contracts,
        liveExecution: true,
      },
    });
    await prisma.signal.create({
      data: {
        accountId: null,
        instrumentSymbol: intent.instrumentSymbol,
        direction: intent.direction!,
        session: intent.session!,
        strategy: intent.strategy ?? "1m ORB + VWAP",
        entryPrice: d.fillPrice,
        stopPrice: intent.stopPrice ?? d.fillPrice,
        targetPrice: intent.targetPrice ?? d.fillPrice,
      },
    });
    await prisma.executionIntent.update({ where: { id: intent.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true, positionId: position.id });
  }

  // action === "exit"
  const position = await prisma.openPosition.findFirst({
    where: { accountId: null, instrumentSymbol: intent.instrumentSymbol },
    orderBy: { openedAt: "desc" },
  });
  if (!position) {
    await prisma.executionIntent.update({ where: { id: intent.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true, note: `no open position for ${intent.instrumentSymbol} — already closed or none opened` });
  }

  try {
    await prisma.openPosition.delete({ where: { id: position.id } });
  } catch {
    await prisma.executionIntent.update({ where: { id: intent.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true, note: "already processed by a concurrent request" });
  }

  const instrument = await prisma.instrument.findUnique({ where: { symbol: position.instrumentSymbol } });
  const riskPerTrade = instrument?.riskPerTrade ?? 150;

  const { net, perDollarRisked } = computeClosePnl({
    direction: position.direction,
    entryPrice: Number(position.entryPrice),
    stopPrice: Number(position.stopPrice),
    exitPrice: d.fillPrice,
    contracts: position.contracts,
    tickValue: instrument?.tickValue ? Number(instrument.tickValue) : null,
    tickSize: instrument?.tickSize ? Number(instrument.tickSize) : null,
    riskPerTrade,
  });

  const outcome = d.outcome ?? (net >= 0 ? "HIT_TARGET" : "STOPPED_OUT");

  const trade = await prisma.trade.create({
    data: {
      accountId: null,
      instrumentSymbol: position.instrumentSymbol,
      direction: position.direction,
      session: position.session,
      strategy: position.strategy,
      entryPrice: position.entryPrice,
      exitPrice: d.fillPrice,
      openedAt: position.openedAt,
      closedAt: new Date(),
      outcome,
      contracts: position.contracts,
      worstPoint: Math.min(0, net),
      bestPoint: Math.max(0, net),
      net,
      perDollarRisked,
      includedInRuleset: true,
      liveExecution: true,
    },
  });

  await prisma.executionIntent.update({ where: { id: intent.id }, data: { processedAt: new Date() } });
  await updateEquityTracking();

  return NextResponse.json({ ok: true, tradeId: trade.id, net });
}
