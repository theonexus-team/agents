import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/**
 * Read-only access to trading-analyst pipeline results (see
 * /api/cron/trading-analyst). Deliberately gated by the desk key even for reads —
 * unlike the main dashboard's GET, which is unauthenticated — because this surfaces
 * strategy findings the user explicitly doesn't want visible to anyone who stumbles
 * onto a dashboard URL. Not linked from any nav; reached only via /analyst directly.
 */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const runs = await prisma.analystRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ runs });
}
