export type TradeLike = {
  net: number;
  perDollarRisked: number;
};

export type TradeStats = {
  closedTrades: number;
  winRate: number;
  netProfit: number;
  profitPerDollarRisked: number;
  worstLosingStretch: number;
};

export function computeStats(trades: TradeLike[]): TradeStats {
  if (trades.length === 0) {
    return { closedTrades: 0, winRate: 0, netProfit: 0, profitPerDollarRisked: 0, worstLosingStretch: 0 };
  }

  const wins = trades.filter((t) => t.net > 0).length;
  const netProfit = trades.reduce((sum, t) => sum + t.net, 0);
  const avgPerDollarRisked =
    trades.reduce((sum, t) => sum + t.perDollarRisked, 0) / trades.length;

  let worstStretch = 0;
  let runningStretch = 0;
  for (const t of trades) {
    if (t.net < 0) {
      runningStretch += t.net;
      worstStretch = Math.min(worstStretch, runningStretch);
    } else {
      runningStretch = 0;
    }
  }

  return {
    closedTrades: trades.length,
    winRate: wins / trades.length,
    netProfit,
    profitPerDollarRisked: avgPerDollarRisked,
    worstLosingStretch: worstStretch,
  };
}

/** Running balance curve (chronological order assumed), returns peak balance reached. */
export function peakBalance(startingBalance: number, tradesChronological: TradeLike[]): number {
  let balance = startingBalance;
  let peak = startingBalance;
  for (const t of tradesChronological) {
    balance += t.net;
    peak = Math.max(peak, balance);
  }
  return peak;
}

/**
 * True max drawdown from a running peak (not just the worst STRETCH of
 * consecutive losers computeStats() tracks — a single large loss right after a
 * peak counts here even if it's not part of a losing streak). Chronological order
 * assumed. Matches backtest/engine/portfolio.py's PortfolioState.max_drawdown_seen.
 */
export function computeMaxDrawdown(startingBalance: number, tradesChronological: { net: number }[]): number {
  let balance = startingBalance;
  let peak = startingBalance;
  let worst = 0;
  for (const t of tradesChronological) {
    balance += t.net;
    peak = Math.max(peak, balance);
    worst = Math.max(worst, peak - balance);
  }
  return worst;
}
