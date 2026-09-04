import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** Read-only access to the risk watchdog's latest status + recent alerts. Same
 * desk-key-gated-on-reads pattern as /api/analyst-runs. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const [status, alerts] = await Promise.all([
    prisma.riskWatchdogStatus.findUnique({ where: { id: "singleton" } }),
    prisma.riskWatchdogAlert.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json({ status, alerts });
}
