import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkExecutionSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

// If a claimed intent never gets reported back within this window, treat the
// watcher as having crashed mid-flight and let it be re-claimed on the next poll —
// otherwise a crash between "claim" and "place order" would strand the intent
// forever with no automatic recovery.
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

// Entry intents older than this never get handed to the watcher — if the PC/watcher
// was down when a signal fired (see README's "does the computer need to be on"),
// firing that entry hours later would place a real order at whatever price NOW is,
// completely disconnected from the market conditions Pine actually saw. Deliberately
// does NOT apply to exits: those close a REAL already-open position, and skipping a
// stale exit would leave that position unmanaged in NinjaTrader — always worse than
// closing it late.
const STALE_ENTRY_MS = 5 * 60 * 1000;

/**
 * Polled by the local NinjaTrader watcher (see ninjatrader-executor/). Returns
 * unclaimed ExecutionIntent rows and atomically marks each one claimed in the same
 * request, so a second poll before the first finishes placing/confirming an order
 * can't grab the same intent and place a duplicate real order.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!checkExecutionSecret(secret)) {
    return NextResponse.json({ error: "Invalid execution secret" }, { status: 401 });
  }

  const staleClaimBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS);
  const candidates = await prisma.executionIntent.findMany({
    where: {
      processedAt: null,
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaimBefore } }],
    },
    orderBy: { createdAt: "asc" },
  });

  const staleEntryBefore = new Date(Date.now() - STALE_ENTRY_MS);
  const claimed = [];
  for (const c of candidates) {
    if (c.action === "entry" && c.createdAt < staleEntryBefore) {
      // Expire without ever handing it to the watcher — see STALE_ENTRY_MS comment.
      // Still goes through the same claim-then-verify race guard as a normal claim,
      // so two overlapping polls can't both try to expire (harmless either way, but
      // keeps the logging below from double-firing).
      const result = await prisma.executionIntent.updateMany({
        where: { id: c.id, OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaimBefore } }] },
        data: { claimedAt: new Date(), processedAt: new Date() },
      });
      if (result.count === 1) {
        console.error(
          `ExecutionIntent ${c.id} (entry, ${c.instrumentSymbol}) expired unfired — ` +
            `${Math.round((Date.now() - c.createdAt.getTime()) / 1000)}s old, over the ${STALE_ENTRY_MS / 1000}s limit`
        );
      }
      continue;
    }
    // Re-check claimedAt in the WHERE, not just the initial read, so two overlapping
    // polls (or a poll racing a stale-claim reclaim) can't both think they won it.
    const result = await prisma.executionIntent.updateMany({
      where: { id: c.id, OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaimBefore } }] },
      data: { claimedAt: new Date() },
    });
    if (result.count === 1) claimed.push(c);
  }

  return NextResponse.json({
    intents: claimed.map((i) => ({
      id: i.id,
      action: i.action,
      symbol: i.instrumentSymbol,
      direction: i.direction,
      session: i.session,
      strategy: i.strategy,
      stopPrice: i.stopPrice ? Number(i.stopPrice) : null,
      targetPrice: i.targetPrice ? Number(i.targetPrice) : null,
      contracts: i.contracts,
      outcomeHint: i.outcomeHint,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
