"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Panel, StatTile } from "@/components/Panel";
import { KalshiControls } from "@/components/KalshiControls";
import { KalshiTradeLog, type KalshiTradeRow } from "@/components/KalshiTradeLog";
import { fmtDateTime, fmtRelative } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

// Stakes/profits here are routinely under $1 - the shared fmtUsd rounds to whole
// dollars, which would turn every sub-$0.50 P&L into a misleading "$0".
function fmtUsd(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${n < 0 ? "-" : sign}$${Math.abs(n).toFixed(2)}`;
}

type KalshiDashboardData = {
  status: {
    online: boolean;
    botLastSeen: string | null;
    paused: boolean;
    killSwitch: boolean;
    killSwitchReason: string | null;
    paperMode: boolean;
  };
  risk: {
    stakePerTrade: number;
    baseStake: number;
    startingBalance: number;
    equity: number;
    maxDailyLoss: number;
    maxDailyProfit: number;
    maxTradesPerDay: number;
    tradesToday: number;
    dailyPnl: number;
  };
  stats: {
    overall: { closedTrades: number; wins: number; winRate: number | null; netProfit: number };
    byStrategy: Record<string, { closedTrades: number; wins: number; winRate: number | null; netProfit: number }>;
  };
  openPosition: {
    id: string;
    ticker: string;
    side: "YES" | "NO";
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    contracts: number;
    windowCloseAt: string;
    openedAt: string;
    isPaper: boolean;
    strategy: string;
  } | null;
  tradeLog: KalshiTradeRow[];
  signals: {
    id: string;
    direction: "LONG" | "SHORT";
    fired: boolean;
    blockedReason: string | null;
    vwapValue: number | null;
    orHigh: number | null;
    orLow: number | null;
    occurredAt: string;
    strategy: string;
  }[];
};

export default function KalshiPage() {
  const [data, setData] = useState<KalshiDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deskKey, setDeskKeyState] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(DESK_KEY_STORAGE_KEY);
    if (saved) setDeskKeyState(saved);
  }, []);

  const setDeskKey = useCallback((key: string) => {
    setDeskKeyState(key);
    if (key) localStorage.setItem(DESK_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(DESK_KEY_STORAGE_KEY);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kalshi/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as KalshiDashboardData);
      setError(null);
    } catch {
      setError("Couldn't reach the Kalshi dashboard route.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) {
    return <main className="flex flex-1 items-center justify-center p-8 text-danger">{error}</main>;
  }
  if (!data) {
    return <main className="flex flex-1 items-center justify-center p-8 text-muted">loading Kalshi bot…</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Kalshi KXBTC15M Bot</h1>
          <Link href="/" className="text-xs text-muted underline decoration-dotted hover:text-foreground">
            ← Dashboard
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
              data.status.online ? "border-accent/40 bg-accent/10 text-accent" : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${data.status.online ? "bg-accent" : "bg-danger"}`} />
            {data.status.online ? "bot online" : "bot offline"}
          </span>
          <span className="text-muted">
            last check-in {data.status.botLastSeen ? fmtRelative(data.status.botLastSeen) : "never"}
          </span>
          {data.status.paused && <span className="text-warn">paused</span>}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
              data.status.paperMode ? "border-warn/40 bg-warn/10 text-warn" : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {data.status.paperMode ? "paper trading — no real orders" : "LIVE — real money"}
          </span>
        </div>
        <p className="text-xs text-muted">
          15-min BTC binary contracts (KXBTC15M) — ORB+VWAP directional signal on BTC spot, active target/stop
          exit on the contract&apos;s own price, forced flatten before settlement.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today's P&L"
          value={fmtUsd(data.risk.dailyPnl, true)}
          sub={`stop at -${fmtUsd(data.risk.maxDailyLoss).slice(1)} or +${fmtUsd(data.risk.maxDailyProfit).slice(1)}`}
        />
        <StatTile label="Trades today" value={`${data.risk.tradesToday} / ${data.risk.maxTradesPerDay}`} />
        <StatTile
          label="Next stake (compounding)"
          value={fmtUsd(data.risk.stakePerTrade)}
          sub={`base ${fmtUsd(data.risk.baseStake)} @ $${data.risk.startingBalance} start`}
        />
        <StatTile label="Open position" value={data.openPosition ? "1" : "0"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Virtual balance"
          value={fmtUsd(data.risk.equity)}
          sub={`started at $${data.risk.startingBalance}${data.status.paperMode ? " (paper)" : ""}`}
        />
        <StatTile
          label="Return"
          value={`${data.risk.equity >= data.risk.startingBalance ? "+" : ""}${(((data.risk.equity - data.risk.startingBalance) / data.risk.startingBalance) * 100).toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Win rate (all time)"
          value={data.stats.overall.winRate !== null ? `${data.stats.overall.winRate}%` : "—"}
          sub={`${data.stats.overall.wins} / ${data.stats.overall.closedTrades} closed`}
        />
        <StatTile label="Net P&L (all time)" value={fmtUsd(data.stats.overall.netProfit, true)} />
        <div className="flex flex-col gap-1.5 rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">By strategy</span>
          {Object.keys(data.stats.byStrategy).length === 0 && <span className="text-xs text-muted">No closed trades yet</span>}
          {Object.entries(data.stats.byStrategy).map(([strategy, s]) => (
            <div key={strategy} className="flex items-center justify-between text-xs">
              <span className="text-muted">{strategy}</span>
              <span className="font-mono">
                {s.winRate !== null ? `${s.winRate}%` : "—"} ({s.wins}/{s.closedTrades}) {fmtUsd(s.netProfit, true)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <KalshiControls
        paused={data.status.paused}
        killSwitch={data.status.killSwitch}
        killSwitchReason={data.status.killSwitchReason}
        hasOpenPosition={!!data.openPosition}
        deskKey={deskKey}
        setDeskKey={setDeskKey}
        onChanged={load}
      />

      {data.openPosition && (
        <Panel title="Open position">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <dt className="text-muted">Ticker</dt>
            <dd className="font-mono">{data.openPosition.ticker}</dd>
            <dt className="text-muted">Strategy</dt>
            <dd>{data.openPosition.strategy}</dd>
            <dt className="text-muted">Side</dt>
            <dd className={data.openPosition.side === "YES" ? "text-accent" : "text-danger"}>{data.openPosition.side}</dd>
            <dt className="text-muted">Entry</dt>
            <dd className="font-mono">{data.openPosition.entryPrice.toFixed(2)}</dd>
            <dt className="text-muted">Size</dt>
            <dd className="font-mono">{data.openPosition.contracts}x</dd>
            <dt className="text-muted">Target</dt>
            <dd className="font-mono text-accent">{data.openPosition.targetPrice.toFixed(2)}</dd>
            <dt className="text-muted">Stop</dt>
            <dd className="font-mono text-danger">{data.openPosition.stopPrice.toFixed(2)}</dd>
            <dt className="text-muted">Window closes</dt>
            <dd className="font-mono text-xs">{fmtDateTime(data.openPosition.windowCloseAt)}</dd>
            <dt className="text-muted">Opened</dt>
            <dd className="font-mono text-xs">{fmtDateTime(data.openPosition.openedAt)}</dd>
          </dl>
        </Panel>
      )}

      <KalshiTradeLog trades={data.tradeLog.filter((t) => t.status !== "open")} />

      <Panel title="Recent signals" subtitle="Includes signals blocked by risk limits, for post-hoc review.">
        <div className="flex flex-col gap-1.5 text-sm">
          {data.signals.length === 0 && <p className="text-muted">No signals yet.</p>}
          {data.signals.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-panel-border/30 py-1.5 text-xs">
              <span className={s.direction === "LONG" ? "text-accent" : "text-danger"}>{s.direction}</span>
              <span className="text-muted">{s.strategy}</span>
              <span className="font-mono text-muted">{fmtDateTime(s.occurredAt)}</span>
              <span className={s.fired ? "text-accent" : "text-muted"}>{s.fired ? "fired" : s.blockedReason ?? "blocked"}</span>
            </div>
          ))}
        </div>
      </Panel>
    </main>
  );
}
