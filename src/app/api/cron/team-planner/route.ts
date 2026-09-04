import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronSecret } from "@/lib/auth";
import { callLlm } from "@/lib/llm";
import { getRecentBoardMessages, formatBoardForPrompt, postToBoard } from "@/lib/agentBoard";
import { getActiveLearnings, formatLearningsForPrompt } from "@/lib/agentLearnings";
import { sendPushToAll } from "@/lib/push";

/**
 * "The team expanding itself" (user's explicit ask, 2026-09-04) — but deliberately
 * ADVISORY, not autonomous code-writing/deploying. This is the one meaningful line
 * held on autonomy in this whole system: Trading Analyst can write to a DATA table
 * (the allowlist) unsupervised because a bad write there costs some paper P&L and
 * is trivially reversible. An agent with unsupervised deploy access to a live app +
 * database is a different risk entirely — a bug there can break or expose the
 * whole system. So this agent proposes, it never builds. A human (or a future
 * Claude Code session) reads AgentProposal rows and decides.
 *
 * Runs weekly (see vercel.json) — "what should the team look like" doesn't need
 * daily re-litigating the way trading performance does.
 */
const CURRENT_TEAM = `
- Trading Analyst (cloud, daily cron): reviews primary-account combo performance,
  auto-applies allowlist changes (add/remove which symbol+strategy+session combos
  can trade at all).
- Risk Watchdog (cloud, event-driven on every trade close + daily heartbeat): pure
  arithmetic drawdown/daily-loss monitoring against real limits, alerts on level
  change.
- Instrument Scout (local, manual trigger only): backtests the live strategies
  against candidate instruments not yet traded, across multiple timeframes.
- Team Planner (this agent, cloud, weekly): proposes new agents for gaps it finds —
  advisory only, never builds anything itself.
`.trim();

export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [boardHistory, learnings, recentProposals] = await Promise.all([
    getRecentBoardMessages(30),
    getActiveLearnings(), // no filter — the team planner should see every agent's learnings, not just "shared"
    prisma.agentProposal.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { title: true, status: true } }),
  ]);

  const system =
    "You are the team planner for an autonomous trading-analysis system. You review what the existing agents have " +
    "been finding and decide whether there's a real, concrete gap — something recurring or important that no " +
    "current agent covers — worth building a new agent for. You are NOT allowed to write or deploy code; you only " +
    "write a proposal for a human to act on. Do not propose something already in the current team below, and do " +
    "not repeat a proposal already made recently (see recent proposals below) unless there's new evidence for it. " +
    "If nothing genuinely new stands out, say so plainly rather than inventing a gap to fill — a forced, thin " +
    "proposal is worse than no proposal. Be concrete: name what data the new agent would need, what would trigger " +
    "it, and what it would actually do — not a vague mission statement.\n\n" +
    `CURRENT TEAM:\n${CURRENT_TEAM}\n\n` +
    `RECENT PROPOSALS (don't repeat these without new evidence):\n${recentProposals.map((p) => `- [${p.status}] ${p.title}`).join("\n") || "(none yet)"}`;

  const user =
    `RECENT BOARD ACTIVITY (last 30 messages across all agents):\n${formatBoardForPrompt(boardHistory)}\n\n` +
    `ACCUMULATED LEARNINGS:\n${formatLearningsForPrompt(learnings)}\n\n` +
    "Based on the above, either propose ONE new agent (format: 'PROPOSAL: <title>\\nGAP: <what's missing and why " +
    "it matters>\\nSPEC: <what it would do, what data it needs, what would trigger it>') or say " +
    "'NO PROPOSAL: <why nothing stands out right now>'.";

  const result = await callLlm(system, user);

  if (/^NO PROPOSAL/i.test(result.trim())) {
    await postToBoard("team-planner", `Team Planner: no new agent proposed this week — ${result}`, "/agent-proposals").catch(() => {});
    return NextResponse.json({ ok: true, status: "no_proposal" });
  }

  const titleMatch = result.match(/PROPOSAL:\s*(.+)/i);
  const gapMatch = result.match(/GAP:\s*([\s\S]*?)(?=\nSPEC:|$)/i);
  const title = titleMatch?.[1]?.trim().slice(0, 200) ?? "Untitled proposal";
  const gapFound = gapMatch?.[1]?.trim() ?? "(see full proposal)";

  const proposal = await prisma.agentProposal.create({
    data: { title, gapFound, proposal: result },
  });

  await postToBoard("team-planner", `Team Planner: new proposal — "${title}". ${result}`, "/agent-proposals").catch(() => {});
  await sendPushToAll("Team Planner: new agent proposed", title, "/agent-proposals").catch(() => {});

  return NextResponse.json({ ok: true, status: "proposed", proposalId: proposal.id });
}
