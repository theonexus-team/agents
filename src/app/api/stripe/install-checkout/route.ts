import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

/**
 * No login required — same trust model as /a/[token] itself: whoever holds the
 * opaque accessToken link can request the paid install for THAT account.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { accessToken: token } });
  if (!account) {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  }

  await prisma.account.update({ where: { id: account.id }, data: { installRequestedAt: new Date() } });

  const origin = new URL(req.url).origin;
  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_INSTALL_PRICE_ID!, quantity: 1 }],
    metadata: { accountId: account.id, kind: "install" },
    success_url: `${origin}/a/${token}/setup?install=success`,
    cancel_url: `${origin}/a/${token}/setup`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
