import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** Read-only access to the shared agent board — same desk-key-gated-on-reads
 * pattern as the other private pages. Includes replyTo's agent+snippet so the page
 * can render actual threads instead of a flat list. */
export async function GET(req: NextRequest) {
  const deskKey = req.nextUrl.searchParams.get("deskKey");
  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }

  const messages = await prisma.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { replyTo: { select: { agent: true, message: true } } },
  });

  return NextResponse.json({ messages });
}
