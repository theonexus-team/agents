import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deskKey, action } = body as {
    deskKey?: string;
    action?: "pause" | "resume" | "flatten" | "ackKillSwitch";
  };

  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "Invalid desk key" }, { status: 401 });
  }

  // Unlike the futures engine/flatten route (which closes a position synchronously
  // against a live quote right here in the request), only the local Python bot holds
  // Kalshi order authority. Every action here just sets a flag the bot's risk poll
  // loop picks up on its own cadence (a few seconds), not instantly.
  switch (action) {
    case "pause":
      await prisma.kalshiEngineState.update({ where: { id: "singleton" }, data: { paused: true } });
      return NextResponse.json({ ok: true, action });
    case "resume":
      await prisma.kalshiEngineState.update({ where: { id: "singleton" }, data: { paused: false } });
      return NextResponse.json({ ok: true, action });
    case "flatten":
      // Reuses the pause flag: the bot's poll loop force-flattens on either
      // paused or killSwitch, so setting paused=true both blocks new entries
      // and triggers an immediate close of anything open.
      await prisma.kalshiEngineState.update({ where: { id: "singleton" }, data: { paused: true } });
      return NextResponse.json({ ok: true, action, note: "Flatten requested — bot will close any open position within its poll interval." });
    case "ackKillSwitch":
      await prisma.kalshiEngineState.update({
        where: { id: "singleton" },
        data: { killSwitch: false, killSwitchReason: null },
      });
      return NextResponse.json({ ok: true, action });
    default:
      return NextResponse.json({ error: "action must be 'pause', 'resume', 'flatten', or 'ackKillSwitch'" }, { status: 400 });
  }
}
