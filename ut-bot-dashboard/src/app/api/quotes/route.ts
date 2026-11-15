import { NextResponse } from "next/server";
import { sampleQuotes } from "@/lib/sample";

// Not connected yet: returns sample prices. lib/marketData.ts (yahoo-finance2, 15 s cache) replaces this.
export function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") || "").split(",").filter(Boolean);
  const all = sampleQuotes();
  return NextResponse.json({ source: "sample", asOf: new Date().toISOString(), quotes: symbols.length ? all.filter((q) => symbols.includes(q.ticker)) : all });
}
