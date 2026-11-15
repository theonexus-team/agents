import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ ok: false, error: "Push not connected yet — set PUSH_PROVIDER / PUSH_TARGET, then wire sendPush()" }, { status: 503 });
}
