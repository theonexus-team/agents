import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const token = await expectedToken();
  // No password configured yet → open, and every page shows a "set DASHBOARD_PASSWORD" banner.
  if (!token) return NextResponse.next();
  if (req.cookies.get(AUTH_COOKIE)?.value === token) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Public: login page, the TradingView webhook (secret-guarded), the cron (CRON_SECRET-guarded), static files.
  matcher: ["/((?!login|api/webhook|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
