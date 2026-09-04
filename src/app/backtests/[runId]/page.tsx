"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EquityCurve } from "@/components/EquityCurve";
import { Panel, StatTile } from "@/components/Panel";
import { TradeLogTable } from "@/components/TradeLogTable";
import { fmtPct, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, type BacktestRunDetail } from "@/lib/types";

export default function BacktestDetailPage({ params }: PageProps<"/backtests/[runId]">) {
  const { runId } = use(params);
  const [run, setRun] = useState<BacktestRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/backtests/${runId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((json: BacktestRunDetail) => setRun(json))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this run."));
  }, [runId]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href="/backtests" className="w-fit text-xs text-muted underline decoration-dotted hover:text-foreground">
          ← All backtests
        </Link>
        {run && (
          <>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {run.strategy} — {INSTRUMENT_LABEL[run.symbol]}
            </h1>
            <p className="text-xs text-muted">
              {run.mode === "FORWARD" ? "Forward test" : "Historical backtest"} · {run.timeframe} ·{" "}
              {new Date(run.dataStart).toLocaleDateString()} → {new Date(run.dataEnd).toLocaleDateString()}
              {run.sourceNote ? ` · ${run.sourceNote}` : ""}
            </p>
          </>
        )}
      </header>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !run && <p className="text-sm text-muted">Loading…</p>}

      {run && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Closed trades" value={String(run.stats.closedTrades)} />
            <StatTile label="Win rate" value={fmtPct(run.stats.winRate * 100)} />
            <StatTile
              label="Net profit"
              value={fmtUsd(run.stats.netProfit, true)}
              sub={`starting balance ${fmtUsd(run.startingBalance)}`}
            />
            <StatTile label="Worst losing stretch" value={fmtUsd(run.stats.worstLosingStretch)} />
          </div>

          <Panel title="Equity curve">
            <EquityCurve startingBalance={run.startingBalance} trades={run.trades} />
          </Panel>

          <Panel title="Parameters" subtitle="Exact values this run was configured with, for reproducibility.">
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">
              {JSON.stringify(run.parameters, null, 2)}
            </pre>
          </Panel>

          <TradeLogTable trades={run.trades} />
        </>
      )}
    </main>
  );
}
