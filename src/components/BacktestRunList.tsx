"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "./Panel";
import { fmtDateTime, fmtPct, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, type BacktestRunSummary } from "@/lib/types";

export function BacktestRunList({ runs }: { runs: BacktestRunSummary[] }) {
  const [strategy, setStrategy] = useState("all");
  const [symbol, setSymbol] = useState("all");
  const [mode, setMode] = useState("all");

  const strategies = useMemo(() => Array.from(new Set(runs.map((r) => r.strategy))).sort(), [runs]);
  const symbols = useMemo(() => Array.from(new Set(runs.map((r) => r.symbol))).sort(), [runs]);

  const filtered = runs.filter(
    (r) =>
      (strategy === "all" || r.strategy === strategy) &&
      (symbol === "all" || r.symbol === symbol) &&
      (mode === "all" || r.mode === mode)
  );

  return (
    <Panel
      title="Backtest runs"
      subtitle={`${filtered.length} of ${runs.length} shown — click a run for the trade log and equity curve.`}
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="rounded border border-panel-border bg-black/20 px-2 py-1 text-foreground"
        >
          <option value="all">All strategies</option>
          {strategies.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded border border-panel-border bg-black/20 px-2 py-1 text-foreground"
        >
          <option value="all">All instruments</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {INSTRUMENT_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded border border-panel-border bg-black/20 px-2 py-1 text-foreground"
        >
          <option value="all">All modes</option>
          <option value="HISTORICAL">Historical</option>
          <option value="FORWARD">Forward</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No backtest runs yet — run one via the Python CLI (see backtest/README.md).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Run</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Range</th>
                <th className="px-2 py-2 text-right font-medium">Trades</th>
                <th className="px-2 py-2 text-right font-medium">Win rate</th>
                <th className="px-2 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pending = r.status === "queued" || r.status === "running";
                const failed = r.status === "failed";
                return (
                  <tr key={r.id} className="border-b border-panel-border/40 hover:bg-white/5">
                    <td className="px-2 py-2">
                      <Link href={`/backtests/${r.id}`} className="text-foreground underline decoration-dotted">
                        {r.strategy}
                      </Link>
                      <div className="text-xs text-muted">
                        {INSTRUMENT_LABEL[r.symbol]} · {r.timeframe} · {r.mode === "FORWARD" ? "Forward" : "Historical"}
                        {r.sourceNote ? ` · ${r.sourceNote}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span
                        className={
                          pending ? "text-warn" : failed ? "text-danger" : "text-muted"
                        }
                      >
                        {pending ? "Queued — waiting for worker" : failed ? "Failed" : "Completed"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">
                      {fmtDateTime(r.dataStart)} → {fmtDateTime(r.dataEnd)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{pending || failed ? "—" : r.tradeCount}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {pending || failed ? "—" : fmtPct(r.stats.winRate * 100)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-mono text-xs ${
                        pending || failed ? "text-muted" : r.stats.netProfit >= 0 ? "text-accent" : "text-danger"
                      }`}
                    >
                      {pending || failed ? "—" : fmtUsd(r.stats.netProfit, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
