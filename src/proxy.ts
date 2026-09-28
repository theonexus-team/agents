import { NextResponse } from "next/server";
import { auth } from "@/lib/authjs";

/**
 * Next.js 16 renamed middleware.ts -> proxy.ts (function `proxy`), and it now
 * always runs on the Node.js runtime (edge isn't selectable), so this can call
 * auth() directly. Cheap cookie-only "is anyone logged in" check — the actual
 * entitlement (comped/paid) check is a live DB read in src/app/(gated)/layout.tsx,
 * not here, so Stripe status logic lives in exactly one place.
 */
export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/", "/backtests/:path*"],
};
