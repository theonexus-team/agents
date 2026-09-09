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
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Sizing</th>
                <th className="text-right">Legs</th>
                <th className="text-right">Trades</th>
                <th className="text-right">Net</th>
                <th className="text-right">Max drawdown</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p) => (
                <tr key={p.id} className="is-clickable">
                  <td>
                    <Link href={`/backtests/portfolios/${p.id}`} className="text-foreground underline decoration-dotted">
                      {p.label}
                    </Link>
                    <div className="text-xs text-muted">
                      started {fmtUsd(p.startingBalance)} · {fmtDateTime(p.createdAt)}
                      {p.sourceNote ? ` · ${p.sourceNote}` : ""}
                    </div>
                  </td>
                  <td className="text-xs text-muted">
                    {p.sizingMode === "dynamic" ? "Dynamic ladder" : "Fixed"}
                    {p.sizingMode === "dynamic" && <div className="text-[10px]">ladder unit {fmtUsd(p.maxLossFromPeak)}</div>}
                  </td>
                  <td className="text-right text-xs">{p.legCount}</td>
                  <td className="text-right text-xs">{p.totalTrades}</td>
                  <td className={`text-right text-xs ${p.totalNet >= 0 ? "text-accent" : "text-danger"}`}>
                    {fmtUsd(p.totalNet, true)}
                  </td>
                  <td className="text-right text-xs text-muted">{fmtUsd(p.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
