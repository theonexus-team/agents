let cache: Set<string> | null = null;

/**
 * Grandfathered mastermind members, matched against their Google account email
 * on first login (see events.createUser in src/lib/authjs.ts). A comma-separated
 * env var, not a DB table — this is a one-time pre-launch seed, not an ongoing
 * admin workflow. Must be set in Vercel (including the owner's own email) before
 * the (gated) paywall is deployed, or comped members get bounced to /billing on
 * first login until manually fixed with a `prisma.user.update`.
 */
export function compedEmails(): Set<string> {
  if (!cache) {
    cache = new Set(
      (process.env.COMPED_MEMBER_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return cache;
}
