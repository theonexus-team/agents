import "dotenv/config";
import { PrismaClient, Direction, Session, Outcome, InstrumentSymbol } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SESSIONS: Session[] = ["TOKYO", "SHANGHAI", "LONDON", "NEW_YORK"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

type InstrumentSeed = {
  symbol: InstrumentSymbol;
  name: string;
  tradeable: boolean;
  research: boolean;
  market: string;
  deployed: boolean;
  basePrice: number;
  tickRange: [number, number];
  riskPerTrade: number;
  minAccounts: number;
  maxAccounts: number;
  currentAccounts: number;
  baseUnitRisk: number;
  liveTradesToward: number;
  gateTarget: number;
};

const INSTRUMENTS: InstrumentSeed[] = [
  {
    symbol: "MGC",
    name: "Gold (micro)",
    tradeable: true,
    research: false,
    market: "COMEX",
    deployed: true,
    basePrice: 4300,
    tickRange: [3, 25],
    riskPerTrade: 150,
    minAccounts: 3,
    maxAccounts: 13,
    currentAccounts: 3,
    baseUnitRisk: 100,
    liveTradesToward: 30,
    gateTarget: 60,
  },
  {
    symbol: "HG",
    name: "Copper",
    tradeable: true,
    research: false,
    market: "COMEX",
    deployed: false,
    basePrice: 6.6,
    tickRange: [0.005, 0.03],
    riskPerTrade: 150,
    minAccounts: 3,
    maxAccounts: 13,
    currentAccounts: 1,
    baseUnitRisk: 100,
    liveTradesToward: 17,
    gateTarget: 60,
  },
  {
    symbol: "MNQ",
    name: "Nasdaq (micro)",
    tradeable: false,
    research: true,
    market: "CME",
    deployed: false,
    basePrice: 29500,
    tickRange: [10, 120],
    riskPerTrade: 100,
    minAccounts: 1,
    maxAccounts: 1,
    currentAccounts: 1,
    baseUnitRisk: 100,
    liveTradesToward: 23,
    gateTarget: 60,
  },
  {
    symbol: "MES",
    name: "S&P 500 (micro)",
    tradeable: false,
    research: true,
    market: "CME",
    deployed: false,
    basePrice: 6450,
    tickRange: [2.5, 25],
    riskPerTrade: 100,
    minAccounts: 1,
    maxAccounts: 1,
    currentAccounts: 1,
    baseUnitRisk: 100,
    liveTradesToward: 0,
    gateTarget: 60,
  },
];

async function main() {
  await prisma.trade.deleteMany();
  await prisma.signal.deleteMany();
  await prisma.openPosition.deleteMany();
  await prisma.priceHealth.deleteMany();
  await prisma.economicEvent.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.engineState.deleteMany();
  await prisma.adminCommand.deleteMany();

  for (const ins of INSTRUMENTS) {
    await prisma.instrument.create({
      data: {
        symbol: ins.symbol,
        name: ins.name,
        tradeable: ins.tradeable,
        research: ins.research,
        market: ins.market,
        deployed: ins.deployed,
        riskPerTrade: ins.riskPerTrade,
        minAccounts: ins.minAccounts,
        maxAccounts: ins.maxAccounts,
        currentAccounts: ins.currentAccounts,
        baseUnitRisk: ins.baseUnitRisk,
        liveTradesToward: ins.liveTradesToward,
        gateTarget: ins.gateTarget,
        paused: false,
      },
    });

    await prisma.priceHealth.create({
      data: {
        instrumentSymbol: ins.symbol,
        lastPrice: ins.basePrice,
        lastUpdatedAt: new Date(Date.now() - 10 * 60 * 1000),
        crossCheckOk: true,
      },
    });
  }

  await prisma.engineState.create({
    data: { id: "singleton", startingBalance: 10000, globalPaused: false, reporterLastSeen: new Date() },
  });

  const seedSampleTrades = process.env.SEED_SAMPLE_TRADES !== "false";

  const now = Date.now();
  const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

  const price: Record<InstrumentSymbol, number> = {
    MGC: 4130,
    HG: 6.5,
    MNQ: 28550,
    MES: 6420,
    // Backtest-only Instrument Scout candidates (see backtest/scout.py) — never get
    // real Instrument rows or sample trades, just need a value here to satisfy the
    // exhaustive Record type.
    MYM: 42000,
    M2K: 2300,
    MCL: 65,
    SIL: 30,
  };

  const tradesToCreate: {
    instrumentSymbol: InstrumentSymbol;
    direction: Direction;
    session: Session;
    strategy: string;
    entryPrice: number;
    exitPrice: number;
    openedAt: Date;
    closedAt: Date;
    outcome: Outcome;
    worstPoint: number;
    bestPoint: number;
    net: number;
    perDollarRisked: number;
    includedInRuleset: boolean;
  }[] = [];

  let t = twentyDaysAgo;
  let hiddenBudget = 12; // 10 shanghai (retired) + 2 crude analog, modeled as excluded HG/Shanghai combo
  const totalTrades = seedSampleTrades ? 70 : 0;

  for (let i = 0; i < totalTrades; i++) {
    t += rand() * 6 * 60 * 60 * 1000 + 20 * 60 * 1000;
    if (t > now) break;

    const ins = pick(INSTRUMENTS);
    const session = pick(SESSIONS);
    const direction: Direction = rand() > 0.5 ? "LONG" : "SHORT";
    const [tickMin, tickMax] = ins.tickRange;
    const stopDistance = tickMin + rand() * (tickMax - tickMin);
    const win = rand() < 0.79;
    const entry = price[ins.symbol];
    const decimals = ins.symbol === "HG" ? 4 : 2;

    const riskUnit = ins.riskPerTrade;
    let rewardMultiple: number;
    let outcome: Outcome;
    if (win) {
      // most wins are small/quick, occasional large runners — mirrors the skew in the original log
      rewardMultiple = 0.02 + rand() * rand() * 1.8;
      outcome = "HIT_TARGET";
    } else {
      rewardMultiple = -(0.8 + rand() * 0.35);
      const r = rand();
      outcome = r < 0.8 ? "STOPPED_OUT" : r < 0.9 ? "CLOSED_AT_DAY_END" : "STOPPED_OUT_TARGET_HIT_LATER";
    }

    const net = Math.round(riskUnit * rewardMultiple * 100) / 100;
    const perDollarRisked = Math.round(rewardMultiple * 100) / 100;
    const priceMove = stopDistance * rewardMultiple;
    const exit = direction === "LONG" ? entry + priceMove : entry - priceMove;

    const heldMinutes = Math.max(1, Math.round(rand() * rand() * 120));
    const openedAt = new Date(t);
    const closedAt = new Date(t + heldMinutes * 60 * 1000);

    const worstPoint = -Math.round(riskUnit * (0.05 + rand() * (win ? 0.9 : 0.25)));
    const bestPoint = Math.round(riskUnit * (0.1 + rand() * (win ? 2.5 : 1.1)));

    let includedInRuleset = true;
    if (ins.symbol === "HG" && session === "SHANGHAI" && hiddenBudget > 0) {
      includedInRuleset = false;
      hiddenBudget--;
    }

    tradesToCreate.push({
      instrumentSymbol: ins.symbol,
      direction,
      session,
      strategy: "Tab reversal",
      entryPrice: Math.round(entry * 10 ** decimals) / 10 ** decimals,
      exitPrice: Math.round(exit * 10 ** decimals) / 10 ** decimals,
      openedAt,
      closedAt,
      outcome,
      worstPoint,
      bestPoint,
      net,
      perDollarRisked,
      includedInRuleset,
    });

    price[ins.symbol] = exit;
  }

  await prisma.trade.createMany({ data: tradesToCreate });

  // Signal feed: mirror the most recent trades as "detected + acted on" entries, newest first.
  const recentForSignals = [...tradesToCreate].slice(-15).reverse();
  for (const tr of recentForSignals) {
    const stopDistance = Math.abs(tr.entryPrice - tr.worstPoint / 10);
    await prisma.signal.create({
      data: {
        instrumentSymbol: tr.instrumentSymbol,
        direction: tr.direction,
        session: tr.session,
        strategy: tr.strategy,
        entryPrice: tr.entryPrice,
        stopPrice:
          tr.direction === "LONG" ? tr.entryPrice - stopDistance * 0.02 : tr.entryPrice + stopDistance * 0.02,
        targetPrice:
          tr.direction === "LONG" ? tr.entryPrice + stopDistance * 0.04 : tr.entryPrice - stopDistance * 0.04,
        occurredAt: tr.openedAt,
      },
    });
  }

  await prisma.economicEvent.createMany({
    data: [
      {
        title: "CNY 1-y Loan Prime Rate",
        country: "CNY",
        releaseAt: new Date(now + 4 * 60 * 60 * 1000),
        tagged: false,
      },
      {
        title: "CNY 5-y Loan Prime Rate",
        country: "CNY",
        releaseAt: new Date(now + 4 * 60 * 60 * 1000),
        tagged: false,
      },
      {
        title: "USD Core CPI m/m",
        country: "USD",
        releaseAt: new Date(now + 15 * 60 * 60 * 1000),
        tagged: true,
      },
      {
        title: "USD Unemployment Claims",
        country: "USD",
        releaseAt: new Date(now + 20 * 60 * 60 * 1000),
        tagged: false,
      },
    ],
  });

  console.log(
    seedSampleTrades
      ? `Seeded ${tradesToCreate.length} sample trades.`
      : "Seeded instruments/engine state only (SEED_SAMPLE_TRADES=false) — no fake trades."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
