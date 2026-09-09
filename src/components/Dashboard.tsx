"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ActivityLog } from "@/components/ActivityLog";
import { DashboardEquityCurve } from "@/components/DashboardEquityCurve";
import { EngineControls } from "@/components/EngineControls";
import { Panel } from "@/components/Panel";
import { SessionCountdowns } from "@/components/SessionCountdowns";
import { SiteHeader } from "@/components/SiteHeader";
import { TradingAlgorithms } from "@/components/TradingAlgorithms";
import { fmtDateTime, fmtPrice, fmtRelative, fmtUsd } from "@/lib/format";
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

  function exportLog() {
    if (!data) return;
    const header = "opened,closed,symbol,direction,session,strategy,entry,exit,outcome,contracts,net,perDollarRisked\n";
    const rows = data.tradeLog
      .map((t) =>
        [
          t.openedAt,
          t.closedAt,
          t.symbol,
          t.direction,
          t.session,
          t.strategy,
          t.entryPrice,
          t.exitPrice,
          t.outcome,
          t.contracts ?? "",
          t.net,
          t.perDollarRisked,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theonexus-trade-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const statusLabel = data.account
    ? `${data.account.name} · Paper`
    : data.liveExecutionMode
      ? "Live — real orders"
      : "Paper · Healthy";
  const statusTone: "accent" | "warn" = data.liveExecutionMode && !data.account ? "warn" : "accent";
  const drawdown = data.risk.peakEquity - data.balance.current;

  return (
    <>
      <SiteHeader showNav={!data.account} status={{ label: statusLabel, tone: statusTone }} />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-7 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1 basis-80">
            <div className="mb-2 text-[11px] tracking-[0.14em] text-brand uppercase">
              {data.account ? "Client account" : "Live strategy"}
            </div>
            <h1 className="m-0 mb-1.5 text-[28px] font-medium text-foreground sm:text-[34px]">
              {data.account ? data.account.name : "1-min ORB · VWAP"}
            </h1>
            <p className="m-0 text-[13px] text-muted">
              Four futures instruments, Tokyo/Shanghai/London/New York opens · last check-in{" "}
              <span className="text-foreground/80">{fmtRelative(data.status.reporterLastSeen)}</span> · mode:{" "}
              {data.status.mode}
              {data.liveExecutionMode ? " (real orders via NinjaTrader)" : " (simulated — no real money)"}
            </p>
            <p className="m-0 mt-1 text-[11px] text-muted/70">
              prices delayed 5 min (standard exchange licensing) — simulated results already account for this
            </p>
          </div>
          <div className="flex flex-none gap-2.5">
            <button onClick={exportLog} className="btn btn-secondary">
              Export log
            </button>
            <a href="#engine-controls" className="btn btn-primary">
              Engine controls
            </a>
          </div>
          {!data.account && (
            <div className="flex basis-full justify-end gap-4">
              <Link href="/kalshi" className="text-xs text-muted underline decoration-dotted hover:text-foreground">
                Kalshi bot →
              </Link>
            </div>
          )}
        </section>

        <section
          className="grid gap-px overflow-hidden rounded-xl"
          style={{ background: "var(--panel-border)", boxShadow: "var(--shadow-sm)", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}
        >
          <StatCell label="Account balance" value={fmtUsd(data.balance.current)} sub={`started ${fmtUsd(data.balance.startedAt)}`} />
          <StatCell label="Peak balance" value={fmtUsd(data.risk.peakEquity)} sub="high watermark" />
          <StatCell
            label="Drawdown from peak"
            value={fmtUsd(drawdown, true)}
            sub={`limit ${fmtUsd(data.risk.maxLossFromPeak)}`}
            valueColor={drawdown > 0 ? "var(--danger)" : undefined}
          />
          <StatCell
            label="Today's P&L"
            value={fmtUsd(data.risk.dailyPnl, true)}
            sub={data.risk.dailyLossHit ? "daily loss limit hit" : `cap -${fmtUsd(data.risk.dailyLossLimit)}`}
            valueColor={data.risk.dailyPnl >= 0 ? "var(--accent)" : "var(--danger)"}
          />
          <StatCell
            label="Position size"
            value={`${data.risk.scaledMicroContracts} contracts`}
            sub="MGC/MNQ scaled · HG fixed at 1"
          />
        </section>

        {data.risk.maxLossBreached && (
          <div className="rounded-md border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
            Max drawdown breached — {fmtUsd(data.risk.peakEquity)} peak minus {fmtUsd(data.risk.maxLossFromPeak)}. All
            new entries are blocked account-wide until acknowledged in Engine controls below.
          </div>
        )}

        <DashboardEquityCurve
          startingBalance={data.balance.startedAt}
          currentBalance={data.balance.current}
          peakEquity={data.risk.peakEquity}
          trades={data.tradeLog}
        />

        <SessionCountdowns sessions={data.sessions} />

        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          <Panel title="Paper record" tag="tradeable set" subtitle="Every trade the current ruleset would have taken — nothing back-filled or invented.">
            {data.hiddenSummary.count > 0 && (
              <p className="mb-3 text-xs text-muted/80">
                {data.hiddenSummary.count} trades sit outside it and are hidden, not deleted:{" "}
                {data.hiddenSummary.winners.count} winners worth {fmtUsd(data.hiddenSummary.winners.amount)} and{" "}
                {data.hiddenSummary.losers.count} losers worth {fmtUsd(data.hiddenSummary.losers.amount)}.
              </p>
            )}
            <p className="mb-4 text-xs text-muted/80">
              Best it has been: {fmtUsd(data.bestEver.tradeableSet)} · gold only {fmtUsd(data.bestEver.goldOnly)} ·
              incl. MNQ research {fmtUsd(data.bestEver.full)}
            </p>
            <StatGrid stats={data.stats.tradeable} />
            <div className="hr" />
            <h3 className="mb-2 text-xs font-medium text-muted">Full record — everything the engine took</h3>
            <StatGrid stats={data.stats.full} />
            <div className="mt-4 overflow-x-auto">
              <table className="table" style={{ minWidth: 380 }}>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Trades</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perInstrument.map((ins) => (
                    <tr key={ins.symbol}>
                      <td>
                        <span className="font-medium">{ins.symbol}</span>{" "}
                        <span className="text-xs text-muted">{ins.name}</span>
                      </td>
                      <td>
                        {ins.trades}
                        {ins.research ? " · research" : ""}
                      </td>
                      <td className={`text-right ${ins.netProfit >= 0 ? "text-accent" : "text-danger"}`}>
                        {fmtUsd(ins.netProfit, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Deployment plan" tag="gate to live" subtitle="How these signals get traded on funded accounts.">
            <div className="flex flex-col gap-4">
              {data.deploymentPlan.map((p) => (
                <div key={p.symbol}>
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-2.5">
                    <span className="text-[15px] font-medium">{p.symbol}</span>
                    <span className="mr-auto text-xs text-muted">
                      {fmtUsd(p.riskPerTrade)}/trade · {p.currentAccounts}→{p.maxAccounts} accounts
                    </span>
                    <span className="text-xs text-brand-2">
                      {p.liveTradesToward}/{p.gateTarget}
                    </span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg,#5d5294,#b5abfc)",
                        width: `${Math.min(100, Math.round((p.liveTradesToward / p.gateTarget) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted/80">
                    Live record: {p.liveStats.closedTrades} trades, {Math.round(p.liveStats.winRate * 100)}% won,{" "}
                    {fmtUsd(p.liveStats.netProfit, true)} at the engine&apos;s own sizing. At the plan&apos;s size that
                    record is {fmtUsd(p.rescaledNet, true)}.
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Open positions" subtitle="Flatten needs the desk key entered in Engine controls below.">
            {data.openPositions.length === 0 ? (
              <p className="text-sm text-muted">Flat. The desk is watching.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.openPositions.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 rounded-[10px] bg-black/20 p-3.5" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium">
                        {p.symbol}{" "}
                        <span className={p.direction === "LONG" ? "text-xs tracking-wide text-accent" : "text-xs tracking-wide text-danger"}>
                          {p.direction}
                        </span>{" "}
                        <span className="text-xs text-muted">{SESSION_LABEL[p.session]}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        entry {fmtPrice(p.entryPrice)} · stop {fmtPrice(p.stopPrice)} · target {fmtPrice(p.targetPrice)}
                      </div>
                    </div>
                    <button
                      onClick={() => flattenOne(p.id)}
                      disabled={flattening === p.id}
                      className="btn btn-danger flex-none"
                    >
                      {flattening === p.id ? "Flattening…" : "Flatten"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {flattenMessage && (
              <p className={`mt-3 text-xs ${flattenMessage.error ? "text-danger" : "text-accent"}`}>{flattenMessage.text}</p>
            )}

            <div className="mt-5">
              <h3 className="mb-3 text-[13px] font-medium">Price-data health</h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
                {data.priceHealth.map((p) => (
                  <div key={p.symbol} className="flex items-center gap-2 rounded-md bg-black/20 px-2.5 py-2">
                    <span
                      className="h-[7px] w-[7px] flex-none rounded-full"
                      style={{ background: p.crossCheckOk ? "var(--accent)" : "var(--warn)" }}
                    />
                    <span className="text-[13px] font-medium">{p.symbol}</span>
                    <span className="ml-auto text-[11px] text-muted">
                      {fmtPrice(p.lastPrice)} · {p.minutesAgo}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="High-impact news" subtitle="No new trades 1 min before/after high-impact releases, no holding through them.">
            {data.econEvents.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled in the next 24 hours.</p>
            ) : (
              <div className="flex flex-col">
                {data.econEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5" style={{ boxShadow: "0 1px 0 var(--panel-border)" }}>
                    <span className="w-16 flex-none text-[13px] text-brand-2">{fmtDateTime(e.releaseAt)}</span>
                    <span className="min-w-0 flex-1 text-[13px]">
                      {e.tagged && <span className="mr-1.5 text-warn">●</span>}
                      {e.country} {e.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <TradingAlgorithms trades={data.tradeLog} />

        <ActivityLog trades={data.tradeLog} signals={data.signals} />

        <div id="engine-controls">
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
        </div>

        <footer className="py-4 text-center text-[11px] text-muted/60">
          Paper record: {fmtUsd(data.stats.full.netProfit, true)} net over {data.stats.full.closedTrades} simulated
          trades in total, of which the tradeable set is {fmtUsd(data.stats.tradeable.netProfit, true)} over{" "}
          {data.stats.tradeable.closedTrades}. Real-money orders are always placed by a human — the bot never trades
          a live account on its own.
        </footer>
      </main>
    </>
  );
}

function StatCell({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-background px-4.5 py-4">
      <div className="text-[11px] tracking-[0.1em] text-muted uppercase">{label}</div>
      <div className="mt-2 text-2xl font-semibold sm:text-[26px]" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

function StatGrid({ stats }: { stats: DashboardData["stats"]["tradeable"] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
      <MiniStat label="closed trades" value={String(stats.closedTrades)} />
      <MiniStat label="win rate" value={`${Math.round(stats.winRate * 100)}%`} />
      <MiniStat label="net profit" value={fmtUsd(stats.netProfit, true)} valueColor={stats.netProfit >= 0 ? "var(--accent)" : "var(--danger)"} />
      <MiniStat label="profit / $1 risked" value={stats.profitPerDollarRisked.toFixed(2)} />
      <MiniStat label="worst losing stretch" value={fmtUsd(stats.worstLosingStretch)} />
    </div>
  );
}

function MiniStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-[19px] font-semibold" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
