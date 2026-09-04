import { randomBytes, timingSafeEqual } from "crypto";

function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The main admin key (env var) — works everywhere, including on behalf of any account. */
export function checkDeskKey(provided: string | null | undefined): boolean {
  return secretsMatch(provided, process.env.DESK_KEY);
}

export function checkWebhookSecret(provided: string | null | undefined): boolean {
  return secretsMatch(provided, process.env.TRADINGVIEW_WEBHOOK_SECRET);
}

/** A given account's own scoped desk key, OR the admin key acting on its behalf. */
export function checkAccountKey(provided: string | null | undefined, accountDeskKey: string): boolean {
  return secretsMatch(provided, accountDeskKey) || checkDeskKey(provided);
}

/** Long, unguessable token — used for both per-account access tokens and desk keys. */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
