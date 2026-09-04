import { NextResponse } from "next/server";
import { getAccountSummaries, tradovateConfigured } from "@/lib/providers/tradovate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!tradovateConfigured()) {
    return NextResponse.json({ configured: false, accounts: [] });
  }

  try {
    const accounts = await getAccountSummaries();
    return NextResponse.json({ configured: true, accounts });
  } catch (err) {
    return NextResponse.json(
      { configured: true, accounts: [], error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
