import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronSecret } from "@/lib/auth";
import { callLlm } from "@/lib/llm";
import { STRATEGY_SESSION_ALLOWLIST } from "@/lib/allowlist";
import { MAX_DAILY_LOSS, MAX_LOSS_FROM_PEAK } from "@/lib/risk";

/**
 * Automated performance-review pipeline. Vercel Cron triggers this on a schedule
 * (see vercel.json) — runs entirely on Vercel's servers, no dependency on any local
 * machine. Three roles, each a distinct LLM call sharing the same window of primary-
 * account trades: Analyst finds divergence from the current allowlist, Risk Manager
 * checks it against real account risk limits and can object once, Adjuster drafts a
 * plain-language proposed diff. Deliberately REVIEW-GATED per the user's explicit
 * choice (2026-09-03) — this route never edits route.ts or deploys anything. It only
 * writes an AnalystRun row for a human (or a future Claude Code session) to read and
 * act on.
 *
 * "Run tests longer" per the user — MIN_TRADES_FOR_PROPOSAL gates the whole LLM
 * pipeline: below it, this just logs a NO_ACTION row noting the sample is still too
 * thin, without spending any LLM calls on it.
 */
const MIN_TRADES_FOR_PROPOSAL = 8;
/** Fallback window start if no prior AnalystRun exists — the moment the current
 * allowlist went live, so the first run only ever looks at post-allowlist trades. */
const ALLOWLIST_LIVE_SINCE = new Date("2026-09-03T18:20:00-04:00");

type ComboStats = {
  symbol: string;
  strategy: string;
  session: string;
  n: number;
  net: number;
  winRate: number;
  maxDrawdown: number;
};

function computeComboStats(
  trades: { instrumentSymbol: string; strategy: string; session: string; net: unknown; closedAt: Date }[]
): ComboStats[] {
  const groups = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = `${t.instrumentSymbol}|${t.strategy}|${t.session}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const out: ComboStats[] = [];
  for (const [key, group] of groups.entries()) {
    const [symbol, strategy, session] = key.split("|");
    const sorted = [...group].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());
    let cum = 0,
      peak = 0,
      maxDD = 0;
    let wins = 0;
    for (const t of sorted) {
      const n = Number(t.net);
      cum += n;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
      if (n > 0) wins++;
    }
    out.push({
      symbol,
      strategy,
      session,
      n: sorted.length,
      net: cum,
      winRate: sorted.length ? (100 * wins) / sorted.length : 0,
      maxDrawdown: maxDD,
    });
  }
  return out.sort((a, b) => b.net - a.net);
}

function formatAllowlist(): string {
  return STRATEGY_SESSION_ALLOWLIST.map((a) => `- ${a.symbol} + ${a.strategy} + ${a.session}`).join("\n");
}

function formatComboStats(stats: ComboStats[]): string {
  if (stats.length === 0) return "(no closed trades in this window)";
  return stats
    .map((s) => `- ${s.symbol} + ${s.strategy} + ${s.session}: ${s.n} trades, ${s.winRate.toFixed(1)}% win rate, net $${s.net.toFixed(2)}, max drawdown $${s.maxDrawdown.toFixed(2)}`)
    .join("\n");
}

export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lastRun = await prisma.analystRun.findFirst({ orderBy: { createdAt: "desc" } });
  const windowStart = lastRun?.windowEnd ?? ALLOWLIST_LIVE_SINCE;
  const windowEnd = new Date();

  const trades = await prisma.trade.findMany({
    where: { accountId: null, closedAt: { gte: windowStart, lt: windowEnd } },
    select: { instrumentSymbol: true, strategy: true, session: true, net: true, closedAt: true },
    orderBy: { closedAt: "asc" },
  });

  if (trades.length < MIN_TRADES_FOR_PROPOSAL) {
    const run = await prisma.analystRun.create({
      data: {
        windowStart,
        windowEnd,
        tradesInWindow: trades.length,
        analystFinding: `Only ${trades.length} trade(s) closed in this window — below the ${MIN_TRADES_FOR_PROPOSAL}-trade minimum to evaluate anything. No LLM calls made. Waiting for more data.`,
        riskVerdict: "n/a — analyst did not propose a change",
        proposedDiff: null,
        status: "NO_ACTION",
      },
    });
    return NextResponse.json({ ok: true, status: "NO_ACTION", reason: "insufficient sample size", runId: run.id });
  }

  const comboStats = computeComboStats(trades);

  const analystSystem =
    "You are the performance analyst for a live futures trading strategy allowlist. " +
    "You are given the CURRENT allowlist (only these (symbol, strategy, session) combos are permitted to trade at all) " +
    "and the ACTUAL performance of those combos over the review window. " +
    "Identify any combo whose live performance clearly diverges from what would justify keeping it on the allowlist " +
    "(persistently negative net, or a win rate that has collapsed) — but only if the sample size for that combo is " +
    "large enough to trust (treat anything under 6 trades as too early to call). If nothing crosses that bar, say so " +
    "plainly and recommend no change. Be concise and concrete — name exact combos, not vague trends.";
  const analystUser = `CURRENT ALLOWLIST:\n${formatAllowlist()}\n\nPERFORMANCE THIS WINDOW (${trades.length} trades, ${windowStart.toISOString()} to ${windowEnd.toISOString()}):\n${formatComboStats(comboStats)}`;

  let analystFinding = await callLlm(analystSystem, analystUser);

  const riskSystem =
    "You are the risk manager reviewing a proposed change to a live futures trading allowlist. " +
    `The account's real risk limits are: max daily loss $${MAX_DAILY_LOSS}, max drawdown from peak equity $${MAX_LOSS_FROM_PEAK}. ` +
    "Given the analyst's finding, either APPROVE it as safe to act on, or OBJECT with a specific reason " +
    "(e.g. the analyst is reacting to too small a sample, or the proposed change would concentrate risk). " +
    "Start your response with either 'APPROVE:' or 'OBJECT:' followed by your reasoning.";

  let riskVerdict = await callLlm(riskSystem, analystFinding);

  if (riskVerdict.trim().toUpperCase().startsWith("OBJECT")) {
    const reviseUser = `${analystUser}\n\nYour original finding:\n${analystFinding}\n\nThe risk manager objected:\n${riskVerdict}\n\nRevise your finding to address this objection, or explain why the objection doesn't apply.`;
    analystFinding = await callLlm(analystSystem, reviseUser);
    riskVerdict = await callLlm(riskSystem, analystFinding);
  }

  const approved = riskVerdict.trim().toUpperCase().startsWith("APPROVE");

  let proposedDiff: string | null = null;
  if (approved && /no change|no combo|nothing crosses|not.*recommend.*change/i.test(analystFinding) === false) {
    const adjusterSystem =
      "You are the adjuster. Given an approved analyst finding about a trading allowlist, draft a concrete, " +
      "plain-language proposed change to STRATEGY_SESSION_ALLOWLIST (a TypeScript array in src/lib/allowlist.ts). " +
      "State exactly which (symbol, strategy, session) entries to add or remove, and one sentence of justification " +
      "per change. If the finding doesn't actually call for a change, say 'NO CHANGE NEEDED' and nothing else.";
    const draft = await callLlm(adjusterSystem, analystFinding);
    if (!/no change needed/i.test(draft.trim())) {
      proposedDiff = draft;
    }
  }

  const run = await prisma.analystRun.create({
    data: {
      windowStart,
      windowEnd,
      tradesInWindow: trades.length,
      analystFinding,
      riskVerdict,
      proposedDiff,
      status: proposedDiff ? "PENDING_REVIEW" : "NO_ACTION",
    },
  });

  return NextResponse.json({ ok: true, status: run.status, runId: run.id });
}
