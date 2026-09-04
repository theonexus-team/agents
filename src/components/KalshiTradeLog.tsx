"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { Panel } from "./Panel";

// Stakes and profits here are routinely under $1 (fast-exit-once-profitable
// philosophy) - the shared fmtUsd rounds to whole dollars, which silently turns
// every sub-$0.50 win into a misleading "$0". Cents matter on this dashboard.
function fmtUsdCents(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${n < 0 ? "-" : sign}$${Math.abs(n).toFixed(2)}`;
}

export type KalshiTradeRow = {
  id: string;
  ticker: string;
  side: "YES" | "NO";
  strikePrice: number;
  entryPrice: number;
  exitPrice: number | null;
  contracts: number;
  status: string;
  outcome: string | null;
  net: number | null;
  feesPaid: number | null;
  openedAt: string;
  closedAt: string | null;
  isPaper: boolean;
  strategy: string;
};

const PAGE_SIZE = 15;

export function KalshiTradeLog({ trades }: { trades: KalshiTradeRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? trades : trades.slice(0, PAGE_SIZE);

  return (
    <Panel title="Kalshi trade log" subtitle={`${visible.length} of ${trades.length} shown, newest first.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-panel-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Opened</th>
              <th className="px-2 py-2 font-medium"></th>
              <th className="px-2 py-2 font-medium">Ticker</th>
              <th className="px-2 py-2 font-medium">Side</th>
              <th className="px-2 py-2 font-medium">Strategy</th>
              <th className="px-2 py-2 text-right font-medium">Entry</th>
              <th className="px-2 py-2 text-right font-medium">Exit</th>
              <th className="px-2 py-2 text-right font-medium">Size</th>
              <th className="px-2 py-2 font-medium">Outcome</th>
              <th className="px-2 py-2 text-right font-medium">Fees</th>
              <th className="px-2 py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-b border-panel-border/40">
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">{fmtDateTime(t.openedAt)}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  {t.isPaper && (
                    <span className="rounded border border-warn/40 px-1.5 py-0.5 text-[10px] uppercase text-warn">paper</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{t.ticker}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className={t.side === "YES" ? "text-accent" : "text-danger"}>{t.side}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{t.strategy}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs">{t.entryPrice.toFixed(2)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs">
                  {t.exitPrice !== null ? t.exitPrice.toFixed(2) : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-muted">{t.contracts}x</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{t.outcome ?? (t.status === "open" ? "open" : "—")}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-muted">
                  {t.feesPaid !== null ? fmtUsdCents(t.feesPaid) : "—"}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2 text-right font-mono text-xs ${
                    t.net === null ? "text-muted" : t.net >= 0 ? "text-accent" : "text-danger"
                  }`}
                >
                  {t.net !== null ? fmtUsdCents(t.net, true) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades.length > PAGE_SIZE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs text-muted underline decoration-dotted hover:text-foreground"
        >
          {showAll ? "Show fewer" : `Show all ${trades.length} trades`}
        </button>
      )}
    </Panel>
  );
}
