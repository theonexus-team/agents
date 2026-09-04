import { NextRequest, NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/auth";
import { runRiskWatchdogCheck } from "@/lib/riskWatchdog";

/**
 * Once-daily heartbeat (Vercel Hobby plan caps crons at once/day — see vercel.json).
 * The real-time trigger is the webhook's exit handler, which calls the same
 * runRiskWatchdogCheck() right after every trade close, when equity can actually
 * change. This just guarantees a fresh status even on a day with zero trades.
 */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runRiskWatchdogCheck();
  return NextResponse.json({ ok: true, ...result });
}
