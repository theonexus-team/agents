import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/marketData";

// Live Yahoo quotes (15 s cache); falls back to sample prices if Yahoo is unreachable.
export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") || "").split(",").filter(Boolean);
  const { source, quotes } = await getQuotes();
  return NextResponse.json({ source, asOf: new Date().toISOString(), quotes: symbols.length ? quotes.filter((q) => symbols.includes(q.ticker)) : quotes });
}
