import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function syncSubscriptionStatus(customerId: string, status: string) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { subscriptionStatus: status },
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "membership" && session.metadata.userId) {
        await prisma.user.update({
          where: { id: session.metadata.userId },
          data: {
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
            subscriptionStatus: "active",
          },
        });
      } else if (session.metadata?.kind === "install" && session.metadata.accountId) {
        await prisma.account.update({
          where: { id: session.metadata.accountId },
          data: { installPaidAt: new Date() },
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription.customer as string, subscription.status);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription.customer as string, "canceled");
      break;
    }
  }

  return NextResponse.json({ received: true });
}
