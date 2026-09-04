import { prisma } from "@/lib/prisma";

/**
 * Matches the discretionary strategy's documented rule: no new trades within 1
 * minute (either side) of a high-impact release. Only ever gates NEW entries —
 * this app doesn't manage open positions minute-to-minute, so "never hold into a
 * release" and the 30-minute general caution window aren't enforced here; those
 * stay a manual/TradingView-side judgment call for now.
 */
const BLACKOUT_MINUTES = 1;

export async function checkNewsBlackout(
  at: Date = new Date()
): Promise<{ blocked: false } | { blocked: true; event: { title: string; country: string; releaseAt: Date } }> {
  const windowStart = new Date(at.getTime() - BLACKOUT_MINUTES * 60_000);
  const windowEnd = new Date(at.getTime() + BLACKOUT_MINUTES * 60_000);
  const event = await prisma.economicEvent.findFirst({
    where: { tagged: true, releaseAt: { gte: windowStart, lte: windowEnd } },
    orderBy: { releaseAt: "asc" },
  });
  if (!event) return { blocked: false };
  return { blocked: true, event: { title: event.title, country: event.country, releaseAt: event.releaseAt } };
}
