import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/serialize";
import { computeMaxDrawdown } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const portfolios = await prisma.portfolioRun.findMany({
    include: { legs: { include: { trades: { select: { net: true, closedAt: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    portfolios.map((p) => {
      const allTrades = p.legs
        .flatMap((leg) => leg.trades.map((t) => ({ net: num(t.net), closedAt: t.closedAt })))
        .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());
      const startingBalance = num(p.startingBalance);
      const totalNet = allTrades.reduce((sum, t) => sum + t.net, 0);
      const maxDrawdown = computeMaxDrawdown(startingBalance, allTrades);

      return {
        id: p.id,
        label: p.label,
        startingBalance,
        maxLossFromPeak: num(p.maxLossFromPeak),
        sizingMode: p.sizingMode,
        sourceNote: p.sourceNote,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        legCount: p.legs.length,
        totalTrades: allTrades.length,
        totalNet,
        maxDrawdown,
      };
    })
  );
}
