/**
 * Public-facing display names for strategies — deliberately opaque so the
 * dashboard (which is public, no login) doesn't hand a viewer the actual
 * mechanism. Internal identifiers (Pine Script alert strings, the Python
 * backtest engine's STRATEGIES keys) are untouched; this only relabels what
 * gets rendered. Add an entry here for every raw string a strategy is ever
 * stored/reported under.
 */
const STRATEGY_DISPLAY_NAME: Record<string, string> = {
  "1m ORB + VWAP": "Ascendant",
  "ORB + VWAP": "Ascendant",
  orb_vwap: "Ascendant",
  "Algo 2 First-Touch Zones": "The Threshold",
  "Algo 2 First-Touch": "The Threshold",
  algo2_first_touch: "The Threshold",
};

export function strategyDisplayName(raw: string): string {
  return STRATEGY_DISPLAY_NAME[raw] ?? raw;
}
