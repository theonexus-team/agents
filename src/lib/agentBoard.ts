import { prisma } from "@/lib/prisma";

export type AgentName = "risk-watchdog" | "trading-analyst" | "instrument-scout" | "team-planner";

/** Posts a message to the shared agent board. Fire-and-forget-friendly — callers
 * should wrap in .catch(() => {}) the same way push notifications are, since a
 * board post failing shouldn't break the agent's own primary job. Pass replyToId
 * (the id returned from a prior postToBoard call) to make this an explicit reply —
 * the board renders it threaded rather than as a parallel announcement. Returns the
 * created message's id so a caller can chain a reply to ITS reply. */
export async function postToBoard(agent: AgentName, message: string, url?: string, replyToId?: string): Promise<string> {
  const row = await prisma.agentMessage.create({ data: { agent, message, url, replyToId } });
  return row.id;
}

/** Recent board history, oldest-relevant-first-ish (newest N, returned oldest to
 * newest so it reads as a conversation) — for feeding into another agent's prompt
 * as context. Kept short on purpose; this is meant to orient an LLM call, not
 * replace reading the dedicated per-agent tables. */
export async function getRecentBoardMessages(limit = 10): Promise<{ id: string; agent: string; message: string; createdAt: Date }[]> {
  const rows = await prisma.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, agent: true, message: true, createdAt: true },
  });
  return rows.reverse();
}

/** Most recent post from a specific agent, if any — used so a reply can be
 * threaded to the actual source instead of just mentioned in passing. */
export async function getLatestFrom(agent: AgentName): Promise<{ id: string; message: string } | null> {
  return prisma.agentMessage.findFirst({
    where: { agent },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true },
  });
}

export function formatBoardForPrompt(rows: { agent: string; message: string; createdAt: Date }[]): string {
  if (rows.length === 0) return "(no recent activity from other agents)";
  return rows.map((r) => `[${r.agent}, ${r.createdAt.toISOString()}] ${r.message}`).join("\n");
}
