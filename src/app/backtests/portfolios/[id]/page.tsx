"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EquityCurve } from "@/components/EquityCurve";
import { Panel, StatTile } from "@/components/Panel";
import { SiteHeader } from "@/components/SiteHeader";
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
    <>
      <SiteHeader status={{ label: "Backtests", tone: "neutral" }} />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <Link href="/backtests/portfolios" className="nx-tab w-fit px-0">
            ← All portfolios
          </Link>
          {portfolio && (
            <>
              <h1 className="m-0 mt-1 text-[26px] font-medium text-foreground">{portfolio.label}</h1>
              <p className="m-0 text-xs text-muted">
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
              <StatTile label="Final equity" value={fmtUsd(portfolio.startingBalance + portfolio.totalNet)} />
            </div>

            <Panel title="Combined equity curve" subtitle="All legs merged in true chronological order — not summed after the fact.">
              <EquityCurve startingBalance={portfolio.startingBalance} trades={portfolio.trades} />
            </Panel>

            <Panel title="Legs" subtitle="Each leg is also its own standalone BacktestRun, viewable on /backtests.">
              <div className="overflow-x-auto">
                <table className="table min-w-[600px]">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Instrument</th>
                      <th className="text-right">Trades</th>
                      <th className="text-right">Win rate</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.legs.map((leg) => (
                      <tr key={leg.runId}>
                        <td>
                          <Link href={`/backtests/${leg.runId}`} className="text-foreground underline decoration-dotted">
                            {leg.strategy}
                          </Link>
                        </td>
                        <td className="text-xs text-muted">{INSTRUMENT_LABEL[leg.symbol]}</td>
                        <td className="text-right text-xs">{leg.stats.closedTrades}</td>
                        <td className="text-right text-xs">{fmtPct(leg.stats.winRate * 100)}</td>
                        <td className={`text-right text-xs ${leg.stats.netProfit >= 0 ? "text-accent" : "text-danger"}`}>
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
    </>
  );
}
