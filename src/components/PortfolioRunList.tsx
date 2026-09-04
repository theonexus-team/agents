"use client";

import Link from "next/link";
import { Panel } from "./Panel";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import type { PortfolioRunSummary } from "@/lib/types";

export function PortfolioRunList({ portfolios }: { portfolios: PortfolioRunSummary[] }) {
  return (
    <Panel
      title="Portfolio runs"
      subtitle="Several strategy legs simulated together on one shared account — combined equity curve, not just each leg summed after the fact."
    >
      {portfolios.length === 0 ? (
        <p className="text-sm text-muted">
          No portfolio runs yet — run one via <code>backtest/run_portfolio.py --config &lt;file&gt;</code> (see
          backtest/README.md).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Portfolio</th>
                <th className="px-2 py-2 font-medium">Sizing</th>
                <th className="px-2 py-2 text-right font-medium">Legs</th>
                <th className="px-2 py-2 text-right font-medium">Trades</th>
                <th className="px-2 py-2 text-right font-medium">Net</th>
                <th className="px-2 py-2 text-right font-medium">Max drawdown</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p) => (
                <tr key={p.id} className="border-b border-panel-border/40 hover:bg-white/5">
                  <td className="px-2 py-2">
                    <Link href={`/backtests/portfolios/${p.id}`} className="text-foreground underline decoration-dotted">
                      {p.label}
                    </Link>
                    <div className="text-xs text-muted">
                      started {fmtUsd(p.startingBalance)} · {fmtDateTime(p.createdAt)}
                      {p.sourceNote ? ` · ${p.sourceNote}` : ""}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted">
                    {p.sizingMode === "dynamic" ? "Dynamic ladder" : "Fixed"}
                    {p.sizingMode === "dynamic" && (
                      <div className="text-[10px]">ladder unit {fmtUsd(p.maxLossFromPeak)}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">{p.legCount}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs">{p.totalTrades}</td>
                  <td className={`px-2 py-2 text-right font-mono text-xs ${p.totalNet >= 0 ? "text-accent" : "text-danger"}`}>
                    {fmtUsd(p.totalNet, true)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-muted">{fmtUsd(p.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
