import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ ok: false, error: "Paper engine not connected yet (needs Supabase)" }, { status: 503 });
}
