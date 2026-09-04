import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** Read-only list of Team Planner proposals — same desk-key-gated-on-reads pattern
 * as the other private pages. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const proposals = await prisma.agentProposal.findMany({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({ proposals });
}
