import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDeskKey } from "@/lib/auth";

/** Stores a browser's Web Push subscription so sendPushToAll() can reach it later.
 * Gated by desk key, same as the pages that offer the "enable notifications" button
 * — no point letting an unauthenticated visitor register to receive alerts about
 * strategy performance. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { deskKey, subscription } = body as {
    deskKey?: string;
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  if (!checkDeskKey(deskKey)) {
    return NextResponse.json({ error: "invalid desk key" }, { status: 401 });
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });

  return NextResponse.json({ ok: true });
}
