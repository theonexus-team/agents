import { prisma } from "@/lib/prisma";
import type { InstrumentSymbol, Session } from "@prisma/client";

export const SYMBOLS = ["MGC", "HG", "MNQ", "MES"] as const;
export const SESSIONS = ["TOKYO", "SHANGHAI", "LONDON", "NEW_YORK"] as const;

/** The two strategies actually wired up to fire live/paper signals — used to
 * validate anything Trading Analyst's Adjuster tries to write, so a malformed or
 * hallucinated strategy name can't silently create a dead allowlist entry. */
export const LIVE_STRATEGIES = ["1m ORB + VWAP", "Algo 2 First-Touch Zones"] as const;

/**
 * Which (symbol, strategy, session) combos are currently trusted to trade AT ALL —
 * everything else is blocked outright before any position (paper or real) is ever
 * opened, not just excluded from real execution like LIVE_EXECUTION_ALLOWLIST in the
 * webhook route. Moved from a hardcoded array to the AllowlistEntry table 2026-09-04
 * so Trading Analyst's Adjuster can apply changes directly — no git commit/redeploy
 * needed from a stateless serverless function. See AllowlistEntry in schema.prisma
 * for the full history/rationale. Legacy/primary account only — client accounts
 * have no comparable performance history yet, so they aren't filtered by this.
 */
export async function isAllowedToTrade(symbol: string, strategy: string, session: string): Promise<boolean> {
  const match = await prisma.allowlistEntry.findFirst({
    where: { active: true, symbol: symbol as InstrumentSymbol, strategy, session: session as Session },
    select: { id: true },
  });
  return match !== null;
}

export async function getActiveAllowlist(): Promise<{ symbol: string; strategy: string; session: string }[]> {
  return prisma.allowlistEntry.findMany({
    where: { active: true },
    select: { symbol: true, strategy: true, session: true },
    orderBy: { addedAt: "asc" },
  });
}

/** No-op if an active entry for this exact combo already exists — callers don't
 * need to check first. */
export async function addAllowlistEntry(symbol: string, strategy: string, session: string, addedBy: string): Promise<void> {
  const existing = await prisma.allowlistEntry.findFirst({
    where: { active: true, symbol: symbol as InstrumentSymbol, strategy, session: session as Session },
  });
  if (existing) return;
  await prisma.allowlistEntry.create({
    data: { symbol: symbol as InstrumentSymbol, strategy, session: session as Session, addedBy },
  });
}

/** No-op if no active entry matches — callers don't need to check first. */
export async function removeAllowlistEntry(symbol: string, strategy: string, session: string, removedBy: string): Promise<void> {
  await prisma.allowlistEntry.updateMany({
    where: { active: true, symbol: symbol as InstrumentSymbol, strategy, session: session as Session },
    data: { active: false, removedAt: new Date(), removedBy },
  });
}
