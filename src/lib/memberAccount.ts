import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/auth";

/**
 * Every mastermind member gets their own Account (own webhookSecret feeding
 * their own dashboard at /a/[accessToken]) — distinct from the owner's
 * un-owned primary Account, which predates this membership system and stays
 * un-linked. Idempotent: safe to call on every gated page load.
 */
export async function getOrCreateMemberAccount(userId: string, displayName: string) {
  const existing = await prisma.account.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.account.create({
    data: {
      userId,
      name: displayName,
      accessToken: generateToken(),
      webhookSecret: generateToken(),
      deskKey: generateToken(),
    },
  });
}
