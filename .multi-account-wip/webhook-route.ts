import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/auth";
import { z } from "zod";
import { Direction, InstrumentSymbol, Outcome, Session } from "@prisma/client";
import { computeClosePnl } from "@/lib/pnl";
import { getCurrentRiskState, todaysRealizedPnl, updateEquityTracking } from "@/lib/risk";
import { computeScaledContracts } from "@/lib/positionSizing";

const SYMBOLS = ["MGC", "HG", "MNQ"] as const;
const SESSIONS = ["TOKYO", "SHANGHAI", "LONDON", "NEW_YORK"] as const;
const OUTCOMES = ["HIT_TARGET", "STOPPED_OUT", "STOPPED_OUT_TARGET_HIT_LATER", "CLOSED_AT_DAY_END"] as const;

const entrySchema = z.object({
  secret: z.string(),
  action: z.literal("entry"),
  symbol: z.enum(SYMBOLS),
  direction: z.enum(["LONG", "SHORT"]),
  session: z.enum(SESSIONS),
  strategy: z.string().default("1m ORB + VWAP"),
  entryPrice: z.number(),
  stopPrice: z.number(),
  targetPrice: z.number(),
  // Optional: when provided, net P&L is computed from real ticks-moved *
  // instrument.tickValue * contracts instead of the normalized riskPerTrade calc.
  contracts: z.number().int().positive().optional(),
});

const exitSchema = z.object({
  secret: z.string(),
  action: z.literal("exit"),
  symbol: z.enum(SYMBOLS),
  exitPrice: z.number(),
  outcome: z.enum(OUTCOMES).optional(),
  worstPoint: z.number().optional(),
  bestPoint: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let json: unknown = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    console.error("TradingView webhook: invalid JSON body:", rawBody);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = (json as { secret?: string }).secret;
  if (!checkWebhookSecret(secret)) {
    console.error("TradingView webhook: invalid secret. Body was:", rawBody);
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  await prisma.engineState.update({
    where: { id: "singleton" },
    data: { reporterLastSeen: new Date() },
  });

  const action = (json as { action?: unknown }).action;

  if (action === "entry") {
    const parsed = entrySchema.safeParse(json);
    if (!parsed.success) {
      console.error("TradingView webhook: entry validation failed.", JSON.stringify(parsed.error.flatten()), "Body was:", rawBody);
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const symbol = d.symbol as InstrumentSymbol;

    // This one check is global, admin-controlled, and applies to every account
    // uniformly — a single instrument-level kill switch, unrelated to any one
    // account's own risk state.
    const instrument = await prisma.instrument.findUnique({ where: { symbol } });
    if (instrument?.paused) {
      return NextResponse.json({ ok: false, reason: `${symbol} is paused, entry ignored` }, { status: 200 });
    }

    // Every entry/exit signal is one shared market event, but each account (you,
    // plus any friend/client accounts) tracks its own balance and position sizing
    // independently — so the same signal fans out into one OpenPosition per account,
    // each with that account's own risk-scaled contract count.
    const accounts = await prisma.account.findMany();
    const results = [];

    for (const account of accounts) {
      if (account.maxLossBreached) {
        results.push({ accountId: account.id, name: account.name, ok: false, reason: "max drawdown breached — needs manual acknowledgment" });
        continue;
      }
      if (account.globalPaused) {
        results.push({ accountId: account.id, name: account.name, ok: false, reason: "account paused" });
        continue;
      }
      const dailyPnl = await todaysRealizedPnl(account.id);
      if (dailyPnl <= -Number(account.dailyLossLimit)) {
        results.push({ accountId: account.id, name: account.name, ok: false, reason: `daily loss limit hit (${dailyPnl.toFixed(2)})` });
        continue;
      }

      // TradingView retries webhook deliveries on non-2xx responses (and occasionally
      // just delivers duplicates), so the exact same entry can arrive multiple times in
      // quick succession. Treat a matching entry within the last 30s as the same signal.
      const recentDuplicate = await prisma.openPosition.findFirst({
        where: {
          accountId: account.id,
          instrumentSymbol: symbol,
          direction: d.direction as Direction,
          session: d.session as Session,
          entryPrice: d.entryPrice,
          openedAt: { gte: new Date(Date.now() - 30_000) },
        },
      });
      if (recentDuplicate) {
        results.push({ accountId: account.id, name: account.name, ok: true, positionId: recentDuplicate.id, note: "duplicate entry ignored" });
        continue;
      }

      // Only one open position per instrument per account at a time — otherwise the
      // ORB Breakout and OB Reversal strategies could each open opposite-direction
      // positions on the same instrument simultaneously within the same account, and
      // an exit alert from either one would have no reliable way to know which open
      // position it was meant to close.
      const alreadyOpen = await prisma.openPosition.findFirst({
        where: { accountId: account.id, instrumentSymbol: symbol },
      });
      if (alreadyOpen) {
        results.push({
          accountId: account.id,
          name: account.name,
          ok: false,
          reason: `already has an open ${alreadyOpen.direction} position (${alreadyOpen.strategy})`,
        });
        continue;
      }

      // Contract count is scaled by this account's own live risk state for MGC/MNQ —
      // Pine has no way to know current drawdown/profit (alerts only flow outward,
      // never queried), so it always sends its fixed baseline; the backend is the
      // actual authority on sizing, per account. HG stays at whatever Pine sent.
      let contracts = d.contracts;
      if (contracts != null && symbol !== "HG") {
        const risk = await getCurrentRiskState(account.id);
        contracts = computeScaledContracts(risk.drawdownFromPeak, risk.profitFromStart, risk.maxLossFromPeak);
      }

      const position = await prisma.openPosition.create({
        data: {
          accountId: account.id,
          instrumentSymbol: symbol,
          direction: d.direction as Direction,
          session: d.session as Session,
          strategy: d.strategy,
          entryPrice: d.entryPrice,
          stopPrice: d.stopPrice,
          targetPrice: d.targetPrice,
          contracts,
        },
      });

      await prisma.signal.create({
        data: {
          accountId: account.id,
          instrumentSymbol: symbol,
          direction: d.direction as Direction,
          session: d.session as Session,
          strategy: d.strategy,
          entryPrice: d.entryPrice,
          stopPrice: d.stopPrice,
          targetPrice: d.targetPrice,
        },
      });

      results.push({ accountId: account.id, name: account.name, ok: true, positionId: position.id, contracts });
    }

    return NextResponse.json({ ok: true, results });
  }

  if (action === "exit") {
    const parsed = exitSchema.safeParse(json);
    if (!parsed.success) {
      console.error("TradingView webhook: exit validation failed.", JSON.stringify(parsed.error.flatten()), "Body was:", rawBody);
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const symbol = d.symbol as InstrumentSymbol;

    const openPositions = await prisma.openPosition.findMany({
      where: { instrumentSymbol: symbol },
      orderBy: { openedAt: "desc" },
    });
    if (openPositions.length === 0) {
      // 200, not 404: this is the expected shape of a duplicate retry of an exit that
      // already succeeded (or a stray exit with nothing to close). Returning an error
      // status here just causes TradingView to retry it again, forever.
      console.error(`TradingView webhook: exit for ${symbol} but no open position exists. Body was:`, rawBody);
      return NextResponse.json({ ok: true, note: `no open position for ${symbol} — already closed or none opened` });
    }

    // Only the most recent position PER ACCOUNT — same "one position per instrument
    // per account" invariant as the entry side.
    const seenAccounts = new Set<string | null>();
    const results = [];

    for (const position of openPositions) {
      if (seenAccounts.has(position.accountId)) continue;
      seenAccounts.add(position.accountId);

      // Atomically claim the position by deleting it first. TradingView can deliver
      // the same exit alert multiple times near-simultaneously; only one concurrent
      // request can win this delete, which prevents duplicate Trade rows from a race
      // where two requests both read the position before either removed it.
      try {
        await prisma.openPosition.delete({ where: { id: position.id } });
      } catch {
        results.push({ accountId: position.accountId, ok: true, note: "already processed by a concurrent request" });
        continue;
      }

      const instrument = await prisma.instrument.findUnique({ where: { symbol } });
      const riskPerTrade = instrument?.riskPerTrade ?? 150;

      const { net, perDollarRisked } = computeClosePnl({
        direction: position.direction,
        entryPrice: Number(position.entryPrice),
        stopPrice: Number(position.stopPrice),
        exitPrice: d.exitPrice,
        contracts: position.contracts,
        tickValue: instrument?.tickValue ? Number(instrument.tickValue) : null,
        tickSize: instrument?.tickSize ? Number(instrument.tickSize) : null,
        riskPerTrade,
      });

      let outcome: Outcome;
      if (d.outcome) {
        outcome = d.outcome as Outcome;
      } else {
        outcome = net >= 0 ? "HIT_TARGET" : "STOPPED_OUT";
      }

      const trade = await prisma.trade.create({
        data: {
          accountId: position.accountId,
          instrumentSymbol: position.instrumentSymbol,
          direction: position.direction,
          session: position.session,
          strategy: position.strategy,
          entryPrice: position.entryPrice,
          exitPrice: d.exitPrice,
          openedAt: position.openedAt,
          closedAt: new Date(),
          outcome,
          contracts: position.contracts,
          worstPoint: d.worstPoint ?? Math.min(0, net),
          bestPoint: d.bestPoint ?? Math.max(0, net),
          net,
          perDollarRisked,
          includedInRuleset: true,
        },
      });

      if (position.accountId) {
        await updateEquityTracking(position.accountId);
      }

      results.push({ accountId: position.accountId, ok: true, tradeId: trade.id, net });
    }

    return NextResponse.json({ ok: true, results });
  }

  console.error("TradingView webhook: unrecognized action. Body was:", rawBody);
  return NextResponse.json({ error: "action must be 'entry' or 'exit'" }, { status: 400 });
}
