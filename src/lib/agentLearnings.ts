import { prisma } from "@/lib/prisma";

export type LearningAgent = "risk-watchdog" | "trading-analyst" | "instrument-scout" | "team-planner" | "shared";

/** Records a new lesson. Doesn't dedupe automatically — if a lesson is being
 * revised/superseded, retire the old one explicitly (see retireLearning) rather
 * than letting near-duplicates pile up. */
export async function recordLearning(agent: LearningAgent, category: string, lesson: string): Promise<void> {
  await prisma.agentLearning.create({ data: { agent, category, lesson } });
}

export async function retireLearning(id: string): Promise<void> {
  await prisma.agentLearning.update({ where: { id }, data: { active: false } });
}

/** Active learnings relevant to an agent — that agent's own plus "shared" ones.
 * Ordered oldest-first so a prompt reads as an accumulated history, not a random
 * bag of rules. */
export async function getActiveLearnings(agent?: LearningAgent): Promise<{ id: string; agent: string; category: string; lesson: string }[]> {
  return prisma.agentLearning.findMany({
    where: { active: true, ...(agent ? { agent: { in: [agent, "shared"] } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, agent: true, category: true, lesson: true },
  });
}

export function formatLearningsForPrompt(rows: { category: string; lesson: string }[]): string {
  if (rows.length === 0) return "(no recorded learnings yet)";
  return rows.map((r) => `[${r.category}] ${r.lesson}`).join("\n");
}
