import { NextResponse } from "next/server";
import { resetPaper } from "@/lib/paper";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { starting_balance?: number };
  const s = resetPaper(typeof body.starting_balance === "number" && body.starting_balance > 0 ? body.starting_balance : undefined);
  return NextResponse.json({ ok: true, starting_balance: s.settings.starting_balance });
}
