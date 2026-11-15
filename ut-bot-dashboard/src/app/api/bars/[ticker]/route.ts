import { NextResponse } from "next/server";
import { sampleBars } from "@/lib/sample";

// Not connected yet: returns a synthetic 2m series. lib/marketData.ts (yahoo chart(), 60 s cache) replaces this.
export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  return NextResponse.json({ source: "sample", ticker, bars: sampleBars(decodeURIComponent(ticker)) });
}
