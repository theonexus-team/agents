export const SYMBOLS = ["MGC", "HG", "MNQ", "MES"] as const;
export const SESSIONS = ["TOKYO", "SHANGHAI", "LONDON", "NEW_YORK"] as const;

/**
 * Which (symbol, strategy, session) combos are currently trusted to trade AT ALL —
 * everything else is blocked outright before any position (paper or real) is ever
 * opened, not just excluded from real execution like LIVE_EXECUTION_ALLOWLIST in the
 * webhook route. Set 2026-09-03 from a review of the primary account's last 6 trading
 * days (51 trades) — every combo that finished net-positive, per the user's explicit
 * list. Some of these (the MES entries especially) are single-trade samples — kept
 * per the user's direct instruction despite the thin sample size, not because the
 * data alone would justify it. MNQ+ORB+Tokyo is deliberately excluded despite a 75%
 * win rate, because its net was still negative (one big loser ate the small wins).
 * MGC isn't listed at all yet — no trades on it in this window to judge either way.
 * Legacy/primary account only — client accounts have no comparable performance
 * history yet, so they aren't filtered by this.
 *
 * Shared between the webhook (which enforces it) and the trading-analyst cron job
 * (which reviews it against live performance and proposes changes for human review —
 * see /api/cron/trading-analyst) so both always read the same source of truth.
 */
export const STRATEGY_SESSION_ALLOWLIST: { symbol: (typeof SYMBOLS)[number]; strategy: string; session: (typeof SESSIONS)[number] }[] = [
  { symbol: "MNQ", strategy: "Algo 2 First-Touch Zones", session: "LONDON" },
  { symbol: "HG", strategy: "1m ORB + VWAP", session: "TOKYO" },
  { symbol: "HG", strategy: "1m ORB + VWAP", session: "SHANGHAI" },
  { symbol: "MES", strategy: "Algo 2 First-Touch Zones", session: "LONDON" },
  { symbol: "MES", strategy: "Algo 2 First-Touch Zones", session: "TOKYO" },
  { symbol: "MNQ", strategy: "1m ORB + VWAP", session: "SHANGHAI" },
  { symbol: "MNQ", strategy: "1m ORB + VWAP", session: "LONDON" },
  { symbol: "MNQ", strategy: "1m ORB + VWAP", session: "NEW_YORK" },
  { symbol: "MES", strategy: "Algo 2 First-Touch Zones", session: "NEW_YORK" },
];

export function isAllowedToTrade(symbol: string, strategy: string, session: string): boolean {
  return STRATEGY_SESSION_ALLOWLIST.some((a) => a.symbol === symbol && a.strategy === strategy && a.session === session);
}
