import { prisma } from "@/lib/prisma";

export type AgentName = "risk-watchdog" | "trading-analyst" | "instrument-scout";

/** Posts a message to the shared agent board. Fire-and-forget-friendly — callers
 * should wrap in .catch(() => {}) the same way push notifications are, since a
 * board post failing shouldn't break the agent's own primary job. */
export async function postToBoard(agent: AgentName, message: string, url?: string): Promise<void> {
  await prisma.agentMessage.create({ data: { agent, message, url } });
}

/** Recent board history, oldest-relevant-first-ish (newest N, returned oldest to
 * newest so it reads as a conversation) — for feeding into another agent's prompt
 * as context. Kept short on purpose; this is meant to orient an LLM call, not
 * replace reading the dedicated per-agent tables. */
export async function getRecentBoardMessages(limit = 10): Promise<{ agent: string; message: string; createdAt: Date }[]> {
  const rows = await prisma.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { agent: true, message: true, createdAt: true },
  });
  return rows.reverse();
}

export function formatBoardForPrompt(rows: { agent: string; message: string; createdAt: Date }[]): string {
  if (rows.length === 0) return "(no recent activity from other agents)";
  return rows.map((r) => `[${r.agent}, ${r.createdAt.toISOString()}] ${r.message}`).join("\n");
}
