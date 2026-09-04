import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAccountKey, checkDeskKey } from "@/lib/auth";
import { InstrumentSymbol } from "@prisma/client";

const VALID_SYMBOLS: InstrumentSymbol[] = ["MGC", "HG", "MNQ", "MES"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deskKey, scope, action, accessToken } = body as {
    deskKey?: string;
    scope?: string;
    action?: "pause" | "resume";
    accessToken?: string;
  };

  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "action must be 'pause' or 'resume'" }, { status: 400 });
  }

  // Account-scoped commands: pausing/resuming/acknowledging one client account. Valid
  // auth is either that account's own desk key, or the main admin key acting on its
  // behalf. No instrument-level pause here — that's the fleet-wide kill switch below,
  // unchanged and shared by every account.
  if (accessToken) {
    const account = await prisma.account.findUnique({ where: { accessToken } });
    if (!account) {
      return NextResponse.json({ error: "Unknown account" }, { status: 404 });
    }
    if (!checkAccountKey(deskKey, account.deskKey)) {
      return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
    }

    if (scope === "maxloss") {
      if (action !== "resume") {
        return NextResponse.json({ error: "maxloss scope only supports action 'resume'" }, { status: 400 });
      }
      // Deliberately re-baselines peakEquity to current equity rather than just
      // flipping a flag back off — a max-loss breach represents the account being
      // blown, so acknowledging it is a fresh drawdown runway from here, the same as
      // starting a new funded account.
      const agg = await prisma.trade.aggregate({ _sum: { net: true }, where: { accountId: account.id } });
      const currentEquity = Number(account.startingBalance) + Number(agg._sum.net ?? 0);
      await prisma.account.update({
        where: { id: account.id },
        data: { maxLossBreached: false, globalPaused: false, peakEquity: currentEquity },
      });
      return NextResponse.json({ ok: true, scope, action, newPeakEquity: currentEquity });
    }

    if (scope === "global") {
      await prisma.account.update({ where: { id: account.id }, data: { globalPaused: action === "pause" } });
      return NextResponse.json({ ok: true, scope, action });
    }

    return NextResponse.json({ error: "scope must be 'global' or 'maxloss' for an account-scoped command" }, { status: 400 });
  }

  // Legacy admin-only path: unchanged from before client accounts existed.
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
  }

  // Deliberately separate from the ordinary global pause/resume below — a max-loss
  // breach represents the account being blown, so acknowledging it re-baselines
  // peakEquity to current equity (a fresh $2,000 drawdown runway from here, same as
  // starting a new funded account) rather than just flipping a flag back off.
  if (scope === "maxloss") {
    if (action !== "resume") {
      return NextResponse.json({ error: "maxloss scope only supports action 'resume'" }, { status: 400 });
    }
    const [engine, agg] = await Promise.all([
      prisma.engineState.findUniqueOrThrow({ where: { id: "singleton" } }),
      prisma.trade.aggregate({ _sum: { net: true }, where: { accountId: null } }),
    ]);
    const currentEquity = Number(engine.startingBalance) + Number(agg._sum.net ?? 0);
    await prisma.engineState.update({
      where: { id: "singleton" },
      data: { maxLossBreached: false, globalPaused: false, peakEquity: currentEquity },
    });
    await prisma.adminCommand.create({ data: { scope, action, status: "queued" } });
    return NextResponse.json({ ok: true, scope, action, newPeakEquity: currentEquity });
  }

  // Toggles whether the primary webhook queues ExecutionIntent rows for the local
  // NinjaTrader watcher (action "resume") instead of creating paper OpenPosition/
  // Trade rows directly from Pine's numbers (action "pause", the default). Admin-
  // only, deliberately not exposed to any client account — this only ever affects
  // the primary/legacy dashboard.
  if (scope === "liveExecution") {
    await prisma.engineState.update({
      where: { id: "singleton" },
      data: { liveExecutionMode: action === "resume" },
    });
    await prisma.adminCommand.create({ data: { scope, action, status: "queued" } });
    return NextResponse.json({ ok: true, scope, action });
  }

  const paused = action === "pause";

  if (scope === "global") {
    await prisma.engineState.update({
      where: { id: "singleton" },
      data: { globalPaused: paused },
    });
  } else if (scope && VALID_SYMBOLS.includes(scope as InstrumentSymbol)) {
    await prisma.instrument.update({
      where: { symbol: scope as InstrumentSymbol },
      data: { paused },
    });
  } else {
    return NextResponse.json({ error: "scope must be 'global' or an instrument symbol" }, { status: 400 });
  }

  await prisma.adminCommand.create({
    data: { scope: scope!, action, status: "queued" },
  });

  return NextResponse.json({ ok: true, scope, action });
}
