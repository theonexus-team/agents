/**
 * Options risk plan (from the client, Nov 15 2026).
 * Percentages are of the option premium paid at entry.
 * Open to confirm: how the position is split across the three targets,
 * which contract is bought (strike / expiry), and whether SELL buys puts.
 */
export interface RiskPlan {
  tradeSizeUsd: number;
  stopPct: number;
  targets: { pct: number; exitFraction: number }[];
}

export const DEFAULT_RISK: RiskPlan = {
  tradeSizeUsd: 250,
  stopPct: 20,
  // Assumed: scale out in thirds (TO CONFIRM).
  targets: [
    { pct: 40, exitFraction: 1 / 3 },
    { pct: 75, exitFraction: 1 / 3 },
    { pct: 100, exitFraction: 1 / 3 },
  ],
};

export interface RiskLevels {
  contracts: number;
  costUsd: number;
  stopPrice: number;
  maxLossUsd: number;
  targets: { pct: number; price: number; contracts: number; profitUsd: number }[];
  maxProfitUsd: number;
}

/** Levels for one trade at a given option premium (per share; 1 contract = 100 shares). */
export function riskLevels(premium: number, plan: RiskPlan = DEFAULT_RISK): RiskLevels {
  const perContract = premium * 100;
  const contracts = Math.max(0, Math.floor(plan.tradeSizeUsd / perContract));
  const costUsd = contracts * perContract;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Split contracts across targets; any remainder rides to the last target.
  let left = contracts;
  const targets = plan.targets.map((t, i) => {
    const n = i === plan.targets.length - 1 ? left : Math.min(left, Math.floor(contracts * t.exitFraction));
    left -= n;
    return { pct: t.pct, price: r2(premium * (1 + t.pct / 100)), contracts: n, profitUsd: r2(n * perContract * (t.pct / 100)) };
  });

  return {
    contracts,
    costUsd: r2(costUsd),
    stopPrice: r2(premium * (1 - plan.stopPct / 100)),
    maxLossUsd: r2(costUsd * (plan.stopPct / 100)),
    targets,
    maxProfitUsd: r2(targets.reduce((a, t) => a + t.profitUsd, 0)),
  };
}
