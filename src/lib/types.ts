export type InstrumentSymbol = "MGC" | "HG" | "MNQ" | "MES";
export type SessionKey = "TOKYO" | "SHANGHAI" | "LONDON" | "NEW_YORK";
export type Direction = "LONG" | "SHORT";
export type Outcome =
  | "HIT_TARGET"
  | "STOPPED_OUT"
  | "STOPPED_OUT_TARGET_HIT_LATER"
  | "CLOSED_AT_DAY_END"
  | "MANUAL_FLATTEN";

export type TradeStats = {
  closedTrades: number;
  winRate: number;
  netProfit: number;
  profitPerDollarRisked: number;
  worstLosingStretch: number;
};

export type TradeRow = {
  id: string;
  symbol: InstrumentSymbol;
  direction: Direction;
  session: SessionKey;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  openedAt: string;
  closedAt: string;
  outcome: Outcome;
  worstPoint: number;
  bestPoint: number;
  net: number;
  perDollarRisked: number;
  contracts: number | null;
  includedInRuleset: boolean;
};

export type DashboardData = {
  // Present only for a client account's scoped dashboard (/a/[accessToken]); null on
  // the primary dashboard.
  account: { name: string; accessToken: string } | null;
  status: { reporterLastSeen: string | null; globalPaused: boolean; mode: string };
  /** Primary dashboard only — always false on a client account's scoped view. */
  liveExecutionMode: boolean;
  risk: {
    peakEquity: number;
    maxLossBreached: boolean;
    maxLossFromPeak: number;
    dailyPnl: number;
    dailyLossLimit: number;
    dailyLossHit: boolean;
    scaledMicroContracts: number;
  };
  startingBalance: number;
  balance: { current: number; startedAt: number; changeAbs: number; changePct: number };
  bestEver: { tradeableSet: number; goldOnly: number; full: number };
  sessions: { session: SessionKey; label: string; opensAt: string }[];
  stats: { tradeable: TradeStats; full: TradeStats };
  hiddenSummary: {
    count: number;
    winners: { count: number; amount: number };
    losers: { count: number; amount: number };
  };
  perInstrument: { symbol: InstrumentSymbol; name: string; research: boolean; netProfit: number; trades: number }[];
  deploymentPlan: {
    symbol: InstrumentSymbol;
    name: string;
    market: string | null;
    deployed: boolean;
    riskPerTrade: number;
    minAccounts: number;
    maxAccounts: number;
    currentAccounts: number;
    liveTradesToward: number;
    gateTarget: number;
    liveStats: TradeStats;
    rescaledNet: number;
  }[];
  priceHealth: { symbol: InstrumentSymbol; lastPrice: number; minutesAgo: number; crossCheckOk: boolean }[];
  econEvents: { id: string; title: string; country: string; releaseAt: string; tagged: boolean }[];
  openPositions: {
    id: string;
    symbol: InstrumentSymbol;
    direction: Direction;
    session: SessionKey;
    strategy: string;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    openedAt: string;
  }[];
  signals: {
    id: string;
    symbol: InstrumentSymbol;
    direction: Direction;
    session: SessionKey;
    strategy: string;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    occurredAt: string;
  }[];
  tradeLog: TradeRow[];
  instruments: { symbol: InstrumentSymbol; name: string; paused: boolean; tradeable: boolean; research: boolean }[];
};

export type BacktestMode = "HISTORICAL" | "FORWARD";

export type BacktestRunSummary = {
  id: string;
  strategy: string;
  symbol: InstrumentSymbol;
  timeframe: string;
  mode: BacktestMode;
  status: string; // "queued" | "running" | "completed" | "failed"
  dataStart: string;
  dataEnd: string;
  sourceNote: string | null;
  parameters: Record<string, unknown>;
  createdAt: string;
  stats: TradeStats;
  tradeCount: number;
};

export type BacktestRunDetail = BacktestRunSummary & {
  startingBalance: number;
  trades: TradeRow[];
};

export type PortfolioRunSummary = {
  id: string;
  label: string;
  startingBalance: number;
  maxLossFromPeak: number;
  sizingMode: string; // "fixed" | "dynamic"
  sourceNote: string | null;
  status: string;
  createdAt: string;
  legCount: number;
  totalTrades: number;
  totalNet: number;
  maxDrawdown: number;
};

export type PortfolioRunDetail = PortfolioRunSummary & {
  legs: {
    runId: string;
    strategy: string;
    symbol: InstrumentSymbol;
    stats: TradeStats;
  }[];
  equityCurve: { closedAt: string; equity: number }[];
  trades: TradeRow[];
};

export const INSTRUMENT_LABEL: Record<InstrumentSymbol, string> = {
  MGC: "MGC · Gold (micro)",
  HG: "HG · Copper",
  MNQ: "MNQ · Nasdaq (micro)",
  MES: "MES · S&P 500 (micro)",
};

export const SESSION_LABEL: Record<SessionKey, string> = {
  TOKYO: "Tokyo",
  SHANGHAI: "Shanghai",
  LONDON: "London",
  NEW_YORK: "New York",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  HIT_TARGET: "hit target",
  STOPPED_OUT: "stopped out",
  STOPPED_OUT_TARGET_HIT_LATER: "stopped out — target hit later",
  CLOSED_AT_DAY_END: "closed at day end",
  MANUAL_FLATTEN: "manually flattened",
};
