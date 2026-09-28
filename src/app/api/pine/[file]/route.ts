import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Hardcoded allowlist, not a directory listing of tradingview/ — that folder
 * also holds theonexus-algo2-first-touch.pine and theonexus-orb-3candle.pine,
 * both deactivated/superseded (see src/lib/allowlist.ts LIVE_STRATEGIES).
 * Adding either to the client download list later is a deliberate code change,
 * not an accidental filesystem-glob exposure. Never copied into public/ since
 * each file has its own webhook secret pasted into the script text.
 */
const FILES: Record<string, string> = {
  "orb-breakout": "theonexus-orb-breakout.pine",
  "ob-reversal": "theonexus-ob-reversal.pine",
};

export async function GET(_req: Request, { params }: RouteContext<"/api/pine/[file]">) {
  const { file } = await params;
  const filename = FILES[file];
  if (!filename) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contents = await readFile(path.join(process.cwd(), "tradingview", filename), "utf8");
  return new NextResponse(contents, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
