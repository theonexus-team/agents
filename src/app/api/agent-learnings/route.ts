import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** Read-only list of accumulated agent learnings — same desk-key-gated-on-reads
 * pattern as the other private pages. Active first, then retired (for history). */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const learnings = await prisma.agentLearning.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ learnings });
}
