import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Sends a push notification to every subscribed device. One row per device (not per
 * user — no login system here, see PushSubscription). A subscription that comes back
 * 404/410 (browser unsubscribed, or the subscription expired) is deleted so the list
 * doesn't accumulate dead endpoints forever.
 */
export async function sendPushToAll(title: string, body: string, url = "/"): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return; // not configured yet — no-op, don't break the caller

  ensureConfigured();

  const subs = await prisma.pushSubscription.findMany();
  const payload = JSON.stringify({ title, body, url });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        // other errors (network blip, etc.) — just skip this one, not fatal
      }
    })
  );
}
