"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Panel, StatTile } from "@/components/Panel";
import { SessionCountdowns } from "@/components/SessionCountdowns";
import { ActivityLog } from "@/components/ActivityLog";
import { EngineControls } from "@/components/EngineControls";
import { fmtDateTime, fmtPct, fmtPrice, fmtRelative, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, SESSION_LABEL, type DashboardData } from "@/lib/types";

/**
 * Renders one dashboard — the primary/legacy one at `/`, or a client account's
 * scoped view at `/a/[accessToken]`. Which one is entirely determined by `apiPath`/
 * `accessToken`: this component has no opinion about accounts itself, it just fetches
 * whatever `apiPath` returns and, when `accessToken` is set, includes it on every
 * control/flatten command so they land on that account instead of the primary one.
 */
export function Dashboard({
  apiPath,
  deskKeyStorageKey,
  accessToken,
}: {
  apiPath: string;
  deskKeyStorageKey: string;
  accessToken?: string;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deskKey, setDeskKeyState] = useState("");
  const [flattening, setFlattening] = useState<string | null>(null);

  // Loaded from localStorage after mount, not in the initializer — this component
  // renders server-side first (localStorage doesn't exist there), so reading it
  // synchronously would throw and reading it eagerly would cause a hydration mismatch.
  useEffect(() => {
    const saved = localStorage.getItem(deskKeyStorageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDeskKeyState(saved);
  }, [deskKeyStorageKey]);

  const setDeskKey = useCallback(
    (key: string) => {
      setDeskKeyState(key);
      if (key) {
        localStorage.setItem(deskKeyStorageKey, key);
      } else {
        localStorage.removeItem(deskKeyStorageKey);
      }
    },
    [deskKeyStorageKey]
  );
  const [flattenMessage, setFlattenMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiPath, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
      setError(null);
    } catch {
      setError("Couldn't reach the dashboard reporter.");
    }
  }, [apiPath]);

  useEffect(() => {
    // Data fetch on mount + poll — the setState happens after the awaited fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const flatten = useCallback(
    async (key: string, positionId?: string): Promise<{ text: string; error: boolean }> => {
      try {
        const res = await fetch("/api/engine/flatten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deskKey: key, positionId, accessToken }),
        });
        const json = await res.json();
        if (!res.ok) {
          return { text: json.error ?? "Flatten rejected.", error: true };
        }
        const closedCount = json.closed?.length ?? 0;
        const queuedCount = json.queued?.length ?? 0;
        const skippedCount = json.skipped?.length ?? 0;
        if (closedCount === 0 && queuedCount === 0 && skippedCount > 0) {
          return { text: json.skipped[0].reason ?? "Couldn't flatten — try again.", error: true };
        }
        const netTotal = (json.closed ?? []).reduce((s: number, c: { net: number }) => s + c.net, 0);
        const parts: string[] = [];
        if (closedCount > 0) {
          parts.push(`flattened ${closedCount} paper position${closedCount === 1 ? "" : "s"} — net ${netTotal >= 0 ? "+" : ""}$${netTotal.toFixed(2)}`);
        }
        if (queuedCount > 0) {
          parts.push(`queued ${queuedCount} real position${queuedCount === 1 ? "" : "s"} for the NinjaTrader watcher to flatten`);
        }
        return { text: parts.join("; ") + ".", error: false };
      } catch {
        return { text: "Network error sending flatten command.", error: true };
      }
    },
    [accessToken]
  );

  async function flattenOne(positionId: string) {
    if (!deskKey) {
      setFlattenMessage({ text: "Enter the desk key in Engine controls first.", error: true });
      return;
    }
    setFlattening(positionId);
    setFlattenMessage(null);
    const result = await flatten(deskKey, positionId);
    setFlattenMessage(result);
    if (!result.error) load();
    setFlattening(null);
  }

  if (error && !data) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-danger">{error}</main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-muted">
        loading Theonexus Trading Oracle…
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Theonexus Trading Oracle{data.account ? ` — ${data.account.name}` : ""}
          </h1>
          {/* Internal-only tools — never shown on a client account's scoped dashboard. */}
          {!data.account && (
            <div className="flex gap-3">
              <Link href="/kalshi" className="text-xs text-muted underline decoration-dotted hover:text-foreground">
                Kalshi bot →
              </Link>
              <Link href="/backtests" className="text-xs text-muted underline decoration-dotted hover:text-foreground">
                Backtests →
              </Link>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            all systems live
          </span>
          <span className="text-muted">
            dashboard reporter checked in {fmtRelative(data.status.reporterLastSeen)}
          </span>
        </div>
        <p className="text-xs text-muted">
          mode: {data.status.mode}
          {data.liveExecutionMode ? " (real orders placed via NinjaTrader)" : " (simulated — no real money)"} ·
          strategy: 1-minute ORB (Tokyo, Shanghai, London, New York opens) with VWAP bias
        </p>
        <p className="text-xs text-muted/70">
          prices delayed 5 min (standard exchange licensing) — simulated results already account for this
        </p>
      </header>

      <SessionCountdowns sessions={data.sessions} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Paper account balance">
          <div className="font-mono text-3xl text-foreground">{fmtUsd(data.balance.current)}</div>
          <p className="mt-1 text-xs text-muted">
            started at {fmtUsd(data.balance.startedAt)} · {data.balance.changeAbs >= 0 ? "up" : "down"}{" "}
            <span className={data.balance.changeAbs >= 0 ? "text-accent" : "text-danger"}>
              {fmtUsd(data.balance.changeAbs, true)}
              {data.balance.startedAt > 0 ? ` (${fmtPct(data.balance.changePct, true)})` : ""}
            </span>
          </p>
        </Panel>

        <Panel title="Best it has been">
          <div className="font-mono text-3xl text-foreground">{fmtUsd(data.bestEver.tradeableSet)}</div>
          <p className="mt-1 text-xs text-muted">
            gold only: {fmtUsd(data.bestEver.goldOnly)} · incl. MNQ research (not tradeable):{" "}
            {fmtUsd(data.bestEver.full)}
          </p>
        </Panel>
      </div>

      <Panel
        title="Risk limits"
        subtitle={`${fmtUsd(data.risk.maxLossFromPeak)} max drawdown from peak equity · ${fmtUsd(data.risk.dailyLossLimit)} max loss per trading day (6pm ET – 5pm ET)`}
        className={data.risk.maxLossBreached ? "border-danger" : undefined}
      >
        {data.risk.maxLossBreached && (
          <div className="mb-3 rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            Max drawdown breached — {fmtUsd(data.risk.peakEquity)} peak minus $
            {data.risk.maxLossFromPeak.toLocaleString()}. All new entries are blocked account-wide until this is
            acknowledged in Engine controls below.
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wide text-muted">Drawdown from peak</span>
            <div className="font-mono text-lg text-foreground">
              {fmtUsd(data.risk.peakEquity - data.balance.current, true)} / {fmtUsd(data.risk.maxLossFromPeak)}
            </div>
            <span className="text-[11px] text-muted/80">peak equity {fmtUsd(data.risk.peakEquity)}</span>
          </div>
          <div className="rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wide text-muted">Today&apos;s P&amp;L</span>
            <div className={`font-mono text-lg ${data.risk.dailyPnl >= 0 ? "text-accent" : "text-danger"}`}>
              {fmtUsd(data.risk.dailyPnl, true)} / -{fmtUsd(data.risk.dailyLossLimit)}
            </div>
            <span className="text-[11px] text-muted/80">
              {data.risk.dailyLossHit ? "daily loss limit hit — resumes next trading day" : "current trading day"}
            </span>
          </div>
          <div className="rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">Current MGC/MNQ size</span>
            <div className="font-mono text-lg text-foreground">{data.risk.scaledMicroContracts} contracts</div>
            <span className="text-[11px] text-muted/80">
              scaled from drawdown/profit — HG stays fixed at 1
            </span>
          </div>
        </div>
      </Panel>

      <Panel
        title="Paper record"
        subtitle="Every trade the current ruleset would have taken. Nothing is back-filled or invented."
      >
        {data.hiddenSummary.count > 0 && (
          <p className="mb-4 text-xs text-muted/80">
            {data.hiddenSummary.count} trades sit outside it and are hidden, not deleted:{" "}
            {data.hiddenSummary.winners.count} winners worth {fmtUsd(data.hiddenSummary.winners.amount)} and{" "}
            {data.hiddenSummary.losers.count} losers worth {fmtUsd(data.hiddenSummary.losers.amount)}.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted">
              Tradeable set — gold (micro) + copper
            </h3>
            <StatGrid stats={data.stats.tradeable} />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted">Full record — everything the engine took</h3>
            <StatGrid stats={data.stats.full} />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {data.perInstrument.map((ins) => (
            <div
              key={ins.symbol}
              className="rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5"
            >
              <div className="text-xs text-muted">{INSTRUMENT_LABEL[ins.symbol]}</div>
              <div className={`font-mono text-lg ${ins.netProfit >= 0 ? "text-accent" : "text-danger"}`}>
                {fmtUsd(ins.netProfit, true)}
              </div>
              <div className="text-[11px] text-muted/70">
                {ins.trades} trades{ins.research ? " · research" : ""}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Deployment plan" subtitle="How these signals get traded on funded accounts.">
        <div className="grid gap-3 sm:grid-cols-2">
          {data.deploymentPlan.map((p) => (
            <div key={p.symbol} className="rounded-md border border-panel-border/60 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm">{p.symbol}</span>
                <span className="text-[11px] text-muted">{p.deployed ? "market deployed" : "not yet deployed"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted">risk / trade</div>
                  <div className="font-mono">{fmtUsd(p.riskPerTrade)}</div>
                </div>
                <div>
                  <div className="text-muted">accounts</div>
                  <div className="font-mono">
                    {p.currentAccounts} → {p.maxAccounts}
                  </div>
                </div>
                <div>
                  <div className="text-muted">gate</div>
                  <div className="font-mono">
                    {p.liveTradesToward}/{p.gateTarget}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted/80">
                {Math.round((p.liveTradesToward / p.gateTarget) * 100)}% to the gate. Live record so far:{" "}
                {p.liveStats.closedTrades} trades, {Math.round(p.liveStats.winRate * 100)}% won,{" "}
                {fmtUsd(p.liveStats.netProfit, true)} at the engine&apos;s own sizing. At the plan&apos;s{" "}
                {fmtUsd(p.riskPerTrade)} risk across {p.currentAccounts} account
                {p.currentAccounts === 1 ? "" : "s"} that same record is {fmtUsd(p.rescaledNet, true)}.
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Price data health" subtitle="Freshness of the live prices feeding the dashboard.">
          <div className="flex flex-col gap-2">
            {data.priceHealth.map((p) => (
              <div key={p.symbol} className="flex items-center justify-between text-sm">
                <span>{INSTRUMENT_LABEL[p.symbol]}</span>
                <span className="font-mono text-muted">
                  {fmtPrice(p.lastPrice)} · {p.minutesAgo}m ago
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted/70">
            {data.priceHealth.every((p) => p.crossCheckOk)
              ? "All price cross-checks passing."
              : "Some price cross-checks are failing."}
          </p>
        </Panel>

        <Panel title="Upcoming economic news (next 24h)" subtitle="No new trades 1 min before/after high-impact releases, no holding through them, and no trades when the ORB session sits between two high-impact releases.">
          {data.econEvents.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled in the next 24 hours.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.econEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span>
                    {e.tagged && <span className="mr-1.5 text-warn">●</span>}
                    {e.country} {e.title}
                  </span>
                  <span className="font-mono text-xs text-muted">{fmtDateTime(e.releaseAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Open positions"
        subtitle="Flatten needs the desk key entered in Engine controls below."
      >
        {data.openPositions.length === 0 ? (
          <p className="text-sm text-muted">Flat. The desk is watching.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.openPositions.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className={p.direction === "LONG" ? "text-accent" : "text-danger"}>{p.direction}</span>{" "}
                  {INSTRUMENT_LABEL[p.symbol]} · {SESSION_LABEL[p.session]}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    in at {fmtPrice(p.entryPrice)} · stop {fmtPrice(p.stopPrice)} · target {fmtPrice(p.targetPrice)}
                  </span>
                  <button
                    onClick={() => flattenOne(p.id)}
                    disabled={flattening === p.id}
                    className="rounded border border-danger/50 px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    {flattening === p.id ? "Flattening…" : "Flatten"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {flattenMessage && (
          <p className={`mt-3 text-xs ${flattenMessage.error ? "text-danger" : "text-accent"}`}>
            {flattenMessage.text}
          </p>
        )}
      </Panel>

      <ActivityLog trades={data.tradeLog} signals={data.signals} />

      <EngineControls
        instruments={data.instruments}
        openPositionCount={data.openPositions.length}
        maxLossBreached={data.risk.maxLossBreached}
        liveExecutionMode={data.liveExecutionMode}
        deskKey={deskKey}
        setDeskKey={setDeskKey}
        onChanged={load}
        onFlattenAll={(key) => flatten(key)}
        accessToken={accessToken}
      />

      <footer className="py-4 text-center text-[11px] text-muted/60">
        Paper record: {fmtUsd(data.stats.full.netProfit, true)} net over {data.stats.full.closedTrades}{" "}
        simulated trades in total, of which the tradeable set is {fmtUsd(data.stats.tradeable.netProfit, true)}{" "}
        over {data.stats.tradeable.closedTrades}. Real-money orders are always placed by a human — the bot
        never trades a live account on its own.
      </footer>
    </main>
  );
}

function StatGrid({ stats }: { stats: DashboardData["stats"]["tradeable"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <StatTile label="closed trades" value={String(stats.closedTrades)} />
      <StatTile label="win rate" value={`${Math.round(stats.winRate * 100)}%`} />
      <StatTile label="net profit" value={fmtUsd(stats.netProfit, true)} />
      <StatTile label="profit / $1 risked" value={stats.profitPerDollarRisked.toFixed(2)} />
      <StatTile label="worst losing stretch" value={fmtUsd(stats.worstLosingStretch)} />
    </div>
  );
}
