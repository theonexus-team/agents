import { NextResponse } from "next/server";
import { getBars } from "@/lib/marketData";

// Live Yahoo 2m bars (60 s cache); falls back to a synthetic series if Yahoo is unreachable.
export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const t = decodeURIComponent(ticker);
  const { source, bars } = await getBars(t);
  return NextResponse.json({ source, ticker: t, bars });
}
