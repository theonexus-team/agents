import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/auth";
import { z } from "zod";
import { Account, Direction, InstrumentSymbol, Outcome, Session } from "@prisma/client";
import { computeClosePnl } from "@/lib/pnl";
import { MAX_DAILY_LOSS, todaysRealizedPnl, updateEquityTracking } from "@/lib/risk";
import { findAccountBySecret, getAccountRiskState, accountTodaysRealizedPnl, updateAccountEquityTracking } from "@/lib/accounts";
import { computeScaledContracts } from "@/lib/positionSizing";
import { checkNewsBlackout } from "@/lib/newsBlackout";
import { SYMBOLS, SESSIONS, isAllowedToTrade } from "@/lib/allowlist";
import { runRiskWatchdogCheck } from "@/lib/riskWatchdog";

const OUTCOMES = ["HIT_TARGET", "STOPPED_OUT", "STOPPED_OUT_TARGET_HIT_LATER", "CLOSED_AT_DAY_END"] as const;

/** MNQ and MES are correlated enough that opposite-direction positions on both at
 * once amount to hedging, not two independent bets — see the anti-hedge check
 * below. Symmetric on purpose (either one can trigger the block against the other). */
const CORRELATED_SYMBOL: Partial<Record<InstrumentSymbol, InstrumentSymbol>> = {
  MNQ: "MES",
  MES: "MNQ",
};

/**
 * Exact (symbol, strategy, timeframe) combos allowed to place REAL orders while
 * liveExecutionMode is on — everything else still gets logged/tracked as a normal
 * paper trade even while the mode is globally "on," rather than being blocked
 * outright. timeframe matters because the SAME strategy+symbol can run as multiple
 * alert instances on different chart timeframes simultaneously (e.g. Algo 2 on MNQ
 * at both 1-min and 15-min) — those look identical without it. Set 2026-08-24/25
 * per the user: only these are trusted with real money right now, everything else
 * needs split-testing first. Update this list, not liveExecutionMode itself, to
 * change what's live. timeframe values are TradingView's own `timeframe.period`
 * strings — "1" for a 1-minute chart, "15" for 15-minute, etc.
 */
const LIVE_EXECUTION_ALLOWLIST: { symbol: (typeof SYMBOLS)[number]; strategy: string; timeframe: string }[] = [
  { symbol: "MNQ", strategy: "Algo 2 First-Touch Zones", timeframe: "15" },
  { symbol: "HG", strategy: "1m ORB + VWAP", timeframe: "1" },
  { symbol: "MNQ", strategy: "1m ORB + VWAP", timeframe: "1" },
];

function isAllowedForLiveExecution(symbol: string, strategy: string, timeframe: string | undefined): boolean {
  return LIVE_EXECUTION_ALLOWLIST.some((a) => a.symbol === symbol && a.strategy === strategy && a.timeframe === timeframe);
}

const entrySchema = z.object({
  secret: z.string(),
  action: z.literal("entry"),
  symbol: z.enum(SYMBOLS),
  direction: z.enum(["LONG", "SHORT"]),
  session: z.enum(SESSIONS),
  strategy: z.string().default("1m ORB + VWAP"),
  // Chart timeframe the alert fired from (TradingView's timeframe.period, e.g. "1",
  // "15") — optional/absent from any Pine script that hasn't been updated to send
  // it yet, in which case it just never matches the live-execution allowlist below
  // (falls through to paper, the safe default) rather than erroring.
  timeframe: z.string().optional(),
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

/**
 * Which account this request's secret belongs to. "legacy" is the original,
 * single-tenant behavior (accountId null everywhere, fleet-wide EngineState/risk.ts)
 * — completely unchanged from before client accounts existed. "account" is a client
 * dashboard's own webhookSecret, routing this signal to ONLY that account's own
 * Trade/OpenPosition/Signal rows and its own balance/drawdown/daily-loss tracking.
 * Deliberately NOT a fan-out (unlike the earlier reverted .multi-account-wip/
 * attempt) — each account's signals are its own, independent trade stream.
 */
type WebhookIdentity = { kind: "legacy"; accountId: null } | { kind: "account"; accountId: string; account: Account };

async function resolveIdentity(secret: string | null | undefined): Promise<WebhookIdentity | null> {
  if (checkWebhookSecret(secret)) return { kind: "legacy", accountId: null };
  const account = await findAccountBySecret(secret);
  if (account) return { kind: "account", accountId: account.id, account };
  return null;
}

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
  const identity = await resolveIdentity(secret);
  if (!identity) {
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

    // This one check is global, admin-controlled, and applies to every account
    // uniformly — a single instrument-level kill switch, unrelated to any one
    // account's own risk state.
    const instrument = await prisma.instrument.findUnique({ where: { symbol: d.symbol as InstrumentSymbol } });
    if (instrument?.paused) {
      return NextResponse.json({ ok: false, reason: `${d.symbol} is paused, entry ignored` }, { status: 200 });
    }

    // Only the primary account is filtered by performance history — client accounts
    // don't have their own combo-level track record yet to filter against.
    if (identity.kind === "legacy" && !(await isAllowedToTrade(d.symbol, d.strategy, d.session))) {
      return NextResponse.json(
        { ok: false, reason: `${d.symbol} + ${d.strategy} + ${d.session} isn't on the trusted-combo allowlist, entry ignored` },
        { status: 200 }
      );
    }

    let maxLossBreached: boolean;
    let globalPaused: boolean;
    let dailyPnl: number;
    let dailyLossLimit: number;
    let liveExecutionMode = false;
    if (identity.kind === "legacy") {
      const engine = await prisma.engineState.findUnique({ where: { id: "singleton" } });
      maxLossBreached = engine?.maxLossBreached ?? false;
      globalPaused = engine?.globalPaused ?? false;
      dailyPnl = await todaysRealizedPnl();
      dailyLossLimit = MAX_DAILY_LOSS;
      liveExecutionMode = engine?.liveExecutionMode ?? false;
    } else {
      maxLossBreached = identity.account.maxLossBreached;
      globalPaused = identity.account.globalPaused;
      dailyPnl = await accountTodaysRealizedPnl(identity.accountId);
      dailyLossLimit = Number(identity.account.dailyLossLimit);
    }

    // Checked ahead of the ordinary pause flag — this one can't be cleared by a
    // normal Resume, it needs its own deliberate acknowledgment.
    if (maxLossBreached) {
      return NextResponse.json(
        { ok: false, reason: "max drawdown breached, entry ignored — needs manual acknowledgment" },
        { status: 200 }
      );
    }
    if (globalPaused) {
      return NextResponse.json({ ok: false, reason: "engine paused, entry ignored" }, { status: 200 });
    }
    if (dailyPnl <= -dailyLossLimit) {
      return NextResponse.json(
        { ok: false, reason: `daily loss limit hit (${dailyPnl.toFixed(2)}), entry ignored until next trading day (6pm ET)` },
        { status: 200 }
      );
    }
    // Matches the discretionary strategy's documented rule: no new trades within 1
    // minute of a high-impact release. Only gates new entries — see newsBlackout.ts.
    // Applies to every account uniformly, same as the instrument-pause check above.
    const newsBlackout = await checkNewsBlackout();
    if (newsBlackout.blocked) {
      return NextResponse.json(
        {
          ok: false,
          reason: `news blackout — ${newsBlackout.event.country} "${newsBlackout.event.title}" at ${newsBlackout.event.releaseAt.toISOString()}, entry ignored`,
        },
        { status: 200 }
      );
    }

    // TradingView retries webhook deliveries on non-2xx responses (and occasionally
    // just delivers duplicates), so the exact same entry can arrive multiple times in
    // quick succession. Treat a matching entry within the last 30s as the same signal.
    // Scoped to this account — a client's duplicate check never matches the primary
    // account's positions or another client's.
    const recentDuplicate = await prisma.openPosition.findFirst({
      where: {
        accountId: identity.accountId,
        instrumentSymbol: d.symbol as InstrumentSymbol,
        direction: d.direction as Direction,
        session: d.session as Session,
        entryPrice: d.entryPrice,
        openedAt: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (recentDuplicate) {
      return NextResponse.json({ ok: true, positionId: recentDuplicate.id, note: "duplicate entry ignored" });
    }

    // Only one open position per instrument per account at a time — otherwise the
    // ORB Breakout and OB Reversal strategies could each open opposite-direction
    // positions on the same instrument simultaneously within the same account, and
    // an exit alert from either one would have no reliable way to know which open
    // position it was meant to close.
    const alreadyOpen = await prisma.openPosition.findFirst({
      where: { accountId: identity.accountId, instrumentSymbol: d.symbol as InstrumentSymbol },
    });
    if (alreadyOpen) {
      return NextResponse.json({
        ok: false,
        reason: `${d.symbol} already has an open ${alreadyOpen.direction} position (${alreadyOpen.strategy}), entry ignored`,
      });
    }

    // MNQ and MES are both equity-index futures, correlated closely enough that an
    // opposite-direction position on the other one isn't a second independent bet —
    // it's a hedge against the position already open, per the user's explicit rule.
    // Blocks the entry rather than letting both sit open simultaneously.
    const correlatedSymbol = CORRELATED_SYMBOL[d.symbol as InstrumentSymbol];
    if (correlatedSymbol) {
      const correlatedOpen = await prisma.openPosition.findFirst({
        where: { accountId: identity.accountId, instrumentSymbol: correlatedSymbol },
      });
      if (correlatedOpen && correlatedOpen.direction !== (d.direction as Direction)) {
        return NextResponse.json({
          ok: false,
          reason: `${d.symbol} ${d.direction} would hedge against the open ${correlatedOpen.direction} ${correlatedSymbol} position, entry ignored`,
        });
      }
    }

    // Contract count for the LEGACY/primary account: as of 2026-09-04, both live
    // strategies compute their own fixed/risk-capped contract count in Pine itself
    // (see the "Scalp Mode" inputs in both .pine scripts — fixedContracts for ORB
    // Breakout, and a zone-risk-auto-scaled tradeContracts for Algo 2), matching
    // the user's own proven discretionary sizing method. The backend no longer
    // overrides this for the legacy account — it used to (dynamic risk-laddered
    // computeScaledContracts(), back when Pine always sent one fixed baseline
    // number with no way to know current drawdown), but that's now in direct
    // conflict with Pine deliberately choosing its own size per trade. Client
    // accounts are UNCHANGED — this redesign is specific to the user's own primary
    // account, client accounts still get the original dynamic scaling below.
    let contracts = d.contracts;
    if (contracts != null && d.symbol !== "HG" && identity.kind !== "legacy") {
      const risk = await getAccountRiskState(identity.accountId);
      contracts = computeScaledContracts(risk.drawdownFromPeak, risk.profitFromStart, risk.maxLossFromPeak);
    }

    // Real execution mode: don't create the dashboard-visible OpenPosition from
    // Pine's own calculated entryPrice — queue an intent for the local NinjaTrader
    // watcher instead. The real OpenPosition only ever gets created once the watcher
    // reports back an actual fill via /api/execution/report. Only for symbol/strategy
    // combos on LIVE_EXECUTION_ALLOWLIST — everything else falls through to the
    // normal paper path below even while liveExecutionMode is globally on.
    if (liveExecutionMode && isAllowedForLiveExecution(d.symbol, d.strategy, d.timeframe)) {
      const alreadyPendingIntent = await prisma.executionIntent.findFirst({
        where: { action: "entry", instrumentSymbol: d.symbol as InstrumentSymbol, processedAt: null },
      });
      if (alreadyPendingIntent) {
        return NextResponse.json({ ok: true, note: "duplicate entry ignored (already queued)" });
      }
      // TEMPORARY (added 2026-08-24): cap every real order at 1 contract while
      // verifying the NinjaTrader pipeline against live signals — deliberately
      // overrides the scaled/baseline count above. Remove this override once a few
      // real fills have gone through cleanly and normal sizing is trusted again.
      const realExecutionContracts = 1;
      const intent = await prisma.executionIntent.create({
        data: {
          action: "entry",
          instrumentSymbol: d.symbol as InstrumentSymbol,
          direction: d.direction as Direction,
          session: d.session as Session,
          strategy: d.strategy,
          stopPrice: d.stopPrice,
          targetPrice: d.targetPrice,
          contracts: realExecutionContracts,
        },
      });
      return NextResponse.json({ ok: true, queued: true, intentId: intent.id });
    }

    const position = await prisma.openPosition.create({
      data: {
        accountId: identity.accountId,
        instrumentSymbol: d.symbol as InstrumentSymbol,
        direction: d.direction as Direction,
        session: d.session as Session,
        strategy: d.strategy,
        entryPrice: d.entryPrice,
        stopPrice: d.stopPrice,
        targetPrice: d.targetPrice,
        contracts,
        liveExecution: false,
      },
    });

    await prisma.signal.create({
      data: {
        accountId: identity.accountId,
        instrumentSymbol: d.symbol as InstrumentSymbol,
        direction: d.direction as Direction,
        session: d.session as Session,
        strategy: d.strategy,
        entryPrice: d.entryPrice,
        stopPrice: d.stopPrice,
        targetPrice: d.targetPrice,
      },
    });

    return NextResponse.json({ ok: true, positionId: position.id });
  }

  if (action === "exit") {
    const parsed = exitSchema.safeParse(json);
    if (!parsed.success) {
      console.error("TradingView webhook: exit validation failed.", JSON.stringify(parsed.error.flatten()), "Body was:", rawBody);
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Scoped to this account — an exit signal only ever closes a position that
    // belongs to the same account its secret resolved to.
    const position = await prisma.openPosition.findFirst({
      where: { accountId: identity.accountId, instrumentSymbol: d.symbol as InstrumentSymbol },
      orderBy: { openedAt: "desc" },
    });
    if (!position) {
      // 200, not 404: this is the expected shape of a duplicate retry of an exit that
      // already succeeded (or a stray exit with nothing to close). Returning an error
      // status here just causes TradingView to retry it again, forever.
      console.error(`TradingView webhook: exit for ${d.symbol} but no open position exists. Body was:`, rawBody);
      return NextResponse.json({ ok: true, note: `no open position for ${d.symbol} — already closed or none opened` });
    }

    // Real execution mode: don't close the OpenPosition from Pine's own calculated
    // exitPrice — queue an intent for the local NinjaTrader watcher, which flattens
    // the REAL position and reports back the real fill via /api/execution/report.
    // The OpenPosition this webhook found above stays open until that report lands.
    // Keyed off the POSITION's own liveExecution flag, not a fresh global-mode
    // check — this is the position that actually exists (or doesn't) in
    // NinjaTrader, which is what determines whether a real flatten is needed,
    // regardless of whether the allowlist or global mode changed since it opened.
    if (position.liveExecution) {
      const alreadyPendingExit = await prisma.executionIntent.findFirst({
        where: { action: "exit", instrumentSymbol: d.symbol as InstrumentSymbol, processedAt: null },
      });
      if (alreadyPendingExit) {
        return NextResponse.json({ ok: true, note: "duplicate exit ignored (already queued)" });
      }
      const intent = await prisma.executionIntent.create({
        data: {
          action: "exit",
          instrumentSymbol: d.symbol as InstrumentSymbol,
          direction: position.direction,
          session: position.session,
          strategy: position.strategy,
          contracts: position.contracts,
          outcomeHint: d.outcome ?? null,
        },
      });
      return NextResponse.json({ ok: true, queued: true, intentId: intent.id });
    }

    // Atomically claim the position by deleting it first. TradingView can deliver the
    // same exit alert multiple times near-simultaneously; only one concurrent request
    // can win this delete, which prevents duplicate Trade rows from a race where two
    // requests both read the position before either removed it.
    try {
      await prisma.openPosition.delete({ where: { id: position.id } });
    } catch {
      return NextResponse.json({ ok: true, note: "already processed by a concurrent request" });
    }

    const instrument = await prisma.instrument.findUnique({ where: { symbol: d.symbol as InstrumentSymbol } });
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
        liveExecution: false,
      },
    });

    if (identity.kind === "legacy") {
      await updateEquityTracking();
      // Equity/drawdown can only change on a trade close (realized P&L only, no
      // live mark-to-market) — this is exactly when the risk watchdog needs to
      // re-check, not on a timer. See src/lib/riskWatchdog.ts.
      await runRiskWatchdogCheck();
    } else {
      await updateAccountEquityTracking(identity.accountId);
    }

    return NextResponse.json({ ok: true, tradeId: trade.id, net });
  }

  console.error("TradingView webhook: unrecognized action. Body was:", rawBody);
  return NextResponse.json({ error: "action must be 'entry' or 'exit'" }, { status: 400 });
}
