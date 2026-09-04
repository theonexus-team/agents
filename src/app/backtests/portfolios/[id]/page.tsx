"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EquityCurve } from "@/components/EquityCurve";
import { Panel, StatTile } from "@/components/Panel";
import { TradeLogTable } from "@/components/TradeLogTable";
import { fmtPct, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, type PortfolioRunDetail } from "@/lib/types";

export default function PortfolioDetailPage({ params }: PageProps<"/backtests/portfolios/[id]">) {
  const { id } = use(params);
  const [portfolio, setPortfolio] = useState<PortfolioRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portfolios/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((json: PortfolioRunDetail) => setPortfolio(json))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this portfolio."));
  }, [id]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/backtests/portfolios"
          className="w-fit text-xs text-muted underline decoration-dotted hover:text-foreground"
        >
          ← All portfolios
        </Link>
        {portfolio && (
          <>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{portfolio.label}</h1>
            <p className="text-xs text-muted">
              {portfolio.sizingMode === "dynamic"
                ? `Dynamic ladder sizing (scales contracts against a ${fmtUsd(portfolio.maxLossFromPeak)} reference unit)`
                : "Fixed sizing"}{" "}
              · {portfolio.legCount} legs
              {portfolio.sourceNote ? ` · ${portfolio.sourceNote}` : ""}
            </p>
          </>
        )}
      </header>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !portfolio && <p className="text-sm text-muted">Loading…</p>}

      {portfolio && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total trades" value={String(portfolio.totalTrades)} />
            <StatTile
              label="Net profit"
              value={fmtUsd(portfolio.totalNet, true)}
              sub={`starting balance ${fmtUsd(portfolio.startingBalance)}`}
            />
            <StatTile
              label="Max drawdown"
              value={fmtUsd(portfolio.maxDrawdown)}
              sub="peak-to-trough, true equity curve — compare against your account's actual drawdown rule yourself"
            />
            <StatTile
              label="Final equity"
              value={fmtUsd(portfolio.startingBalance + portfolio.totalNet)}
            />
          </div>

          <Panel title="Combined equity curve" subtitle="All legs merged in true chronological order — not summed after the fact.">
            <EquityCurve startingBalance={portfolio.startingBalance} trades={portfolio.trades} />
          </Panel>

          <Panel title="Legs" subtitle="Each leg is also its own standalone BacktestRun, viewable on /backtests.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-panel-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Strategy</th>
                    <th className="px-2 py-2 font-medium">Instrument</th>
                    <th className="px-2 py-2 text-right font-medium">Trades</th>
                    <th className="px-2 py-2 text-right font-medium">Win rate</th>
                    <th className="px-2 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.legs.map((leg) => (
                    <tr key={leg.runId} className="border-b border-panel-border/40">
                      <td className="px-2 py-2">
                        <Link href={`/backtests/${leg.runId}`} className="text-foreground underline decoration-dotted">
                          {leg.strategy}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted">{INSTRUMENT_LABEL[leg.symbol]}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{leg.stats.closedTrades}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtPct(leg.stats.winRate * 100)}</td>
                      <td
                        className={`px-2 py-2 text-right font-mono text-xs ${
                          leg.stats.netProfit >= 0 ? "text-accent" : "text-danger"
                        }`}
                      >
                        {fmtUsd(leg.stats.netProfit, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <TradeLogTable trades={portfolio.trades} />
        </>
      )}
    </main>
  );
}
