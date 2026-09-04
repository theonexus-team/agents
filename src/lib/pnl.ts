export type ClosePnlInput = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopPrice: number;
  exitPrice: number;
  contracts: number | null;
  tickValue: number | null;
  tickSize: number | null;
  riskPerTrade: number;
};

export type ClosePnlResult = {
  net: number;
  perDollarRisked: number;
};

/** Shared close-out math for both the TradingView exit webhook and a manual flatten. */
export function computeClosePnl(input: ClosePnlInput): ClosePnlResult {
  const stopDistance = Math.abs(input.entryPrice - input.stopPrice) || 1;
  const priceMove =
    input.direction === "LONG" ? input.exitPrice - input.entryPrice : input.entryPrice - input.exitPrice;

  if (input.contracts && input.tickValue && input.tickSize) {
    const ticksMoved = priceMove / input.tickSize;
    const net = Math.round(ticksMoved * input.tickValue * input.contracts * 100) / 100;
    const stopTicks = stopDistance / input.tickSize;
    const dollarRisk = stopTicks * input.tickValue * input.contracts;
    const perDollarRisked = dollarRisk > 0 ? Math.round((net / dollarRisk) * 100) / 100 : 0;
    return { net, perDollarRisked };
  }

  const net = Math.round((priceMove / stopDistance) * input.riskPerTrade * 100) / 100;
  const perDollarRisked = Math.round((net / input.riskPerTrade) * 100) / 100;
  return { net, perDollarRisked };
}
