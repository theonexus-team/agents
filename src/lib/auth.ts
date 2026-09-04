import { randomBytes, timingSafeEqual } from "crypto";

function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkDeskKey(provided: string | null | undefined): boolean {
  return secretsMatch(provided, process.env.DESK_KEY);
}

export function checkWebhookSecret(provided: string | null | undefined): boolean {
  return secretsMatch(provided, process.env.TRADINGVIEW_WEBHOOK_SECRET);
}

/** Separate trust boundary from checkWebhookSecret on purpose: this one asserts "a
 * real order actually filled," a stronger claim than "TradingView thinks this should
 * happen" — see /api/execution/*. Only the local NinjaTrader watcher should hold it. */
export function checkExecutionSecret(provided: string | null | undefined): boolean {
  return secretsMatch(provided, process.env.EXECUTION_REPORTER_SECRET);
}

/** A client account's own scoped desk key, OR the admin key acting on its behalf. */
export function checkAccountKey(provided: string | null | undefined, accountDeskKey: string): boolean {
  return secretsMatch(provided, accountDeskKey) || checkDeskKey(provided);
}

/** Long, unguessable token — used for both per-account access tokens and webhook secrets/desk keys. */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
