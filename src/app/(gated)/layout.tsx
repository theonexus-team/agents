import { redirect } from "next/navigation";
import { auth } from "@/lib/authjs";
import { prisma } from "@/lib/prisma";

/**
 * Live DB read on every navigation into this group — deliberately not trusting
 * the JWT for entitlement, so a Stripe cancellation (webhook) takes effect
 * immediately instead of waiting for the session cookie to rotate. src/proxy.ts
 * only checks "is anyone logged in at all"; this checks "is THIS user entitled."
 */
export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const entitled = Boolean(user?.comped || user?.subscriptionStatus === "active");
  if (!entitled) {
    redirect("/billing");
  }

  return <>{children}</>;
}
