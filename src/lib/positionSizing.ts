/**
 * Contract-count ladder for MGC/MNQ, scaled off current account risk state. Expressed
 * as fractions of MAX_LOSS_FROM_PEAK (the account's max drawdown limit) so the same
 * ladder applies to any account size — a $2,000 max drawdown is treated as "1 unit"
 * regardless of whether that's a $50k funded account or a live account funded with
 * exactly $2,000.
 *
 * Drawdown side (reduces below the 4-contract baseline as drawdown from peak grows):
 *   0-24% of max drawdown  -> 4 (baseline)
 *   25-49%                 -> 3
 *   50-74%                 -> 2
 *   75-99%                 -> 1
 *   100%+                  -> account is halted separately (see /lib/risk.ts), moot here
 *
 * Profit side (scales up beyond baseline as net profit from starting balance grows;
 * only applies when NOT currently in a drawdown-reduction zone — safety takes
 * precedence over scaling up):
 *   < 25% of unit ($500)   -> 4 (baseline)
 *   25-74% ($500-$1499)    -> 5
 *   75%+ ($1500)           -> 6, then +1 contract per additional 50% of unit ($1000),
 *                              capped at 40 contracts total.
 *
 * HG is never scaled by this — it's a full-size contract, not a micro, and the
 * "never above 40 micros" ceiling specifically refers to MGC/MNQ.
 */
const BASELINE_CONTRACTS = 4;
const MAX_MICRO_CONTRACTS = 40;

export function computeScaledContracts(
  drawdownFromPeak: number,
  profitFromStart: number,
  maxLossFromPeak: number
): number {
  const ddFraction = maxLossFromPeak > 0 ? drawdownFromPeak / maxLossFromPeak : 0;

  if (ddFraction >= 0.75) return 1;
  if (ddFraction >= 0.5) return 2;
  if (ddFraction >= 0.25) return 3;

  if (profitFromStart < 0.25 * maxLossFromPeak) return BASELINE_CONTRACTS;
  if (profitFromStart < 0.75 * maxLossFromPeak) return BASELINE_CONTRACTS + 1;

  const stepsBeyond = Math.floor((profitFromStart - 0.75 * maxLossFromPeak) / (0.5 * maxLossFromPeak));
  return Math.min(MAX_MICRO_CONTRACTS, BASELINE_CONTRACTS + 2 + stepsBeyond);
}
