import { NextResponse } from "next/server";
import { appendEvent } from "@/lib/store";
import { DEFAULT_SETTINGS } from "@/lib/paper";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { starting_balance?: number };
  const sb = typeof body.starting_balance === "number" && body.starting_balance > 0 ? body.starting_balance : undefined;
  await appendEvent({ kind: "reset", at: Date.now(), starting_balance: sb });
  return NextResponse.json({ ok: true, starting_balance: sb ?? DEFAULT_SETTINGS.starting_balance });
}
