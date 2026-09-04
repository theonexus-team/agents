"use client";

import { useState } from "react";
import { fmtDateTime, fmtHeld, fmtPrice, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, OUTCOME_LABEL, SESSION_LABEL, type TradeRow } from "@/lib/types";
import { Panel } from "./Panel";

const PAGE_SIZE = 15;

export function TradeLogTable({ trades }: { trades: TradeRow[] }) {
  const [selected, setSelected] = useState<TradeRow | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? trades : trades.slice(0, PAGE_SIZE);

  return (
    <Panel
      title="Trade log"
      subtitle={`${visible.length} of ${trades.length} shown, newest first — one row per closed trade. Click any row for the full breakdown.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-panel-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Opened</th>
              <th className="px-2 py-2 font-medium">Closed</th>
              <th className="px-2 py-2 font-medium">Trade</th>
              <th className="px-2 py-2 font-medium">Session</th>
              <th className="px-2 py-2 font-medium">Strategy</th>
              <th className="px-2 py-2 font-medium">Entry</th>
              <th className="px-2 py-2 font-medium">Exit</th>
              <th className="px-2 py-2 font-medium">Held</th>
              <th className="px-2 py-2 font-medium">Outcome</th>
              <th className="px-2 py-2 text-right font-medium">Size</th>
              <th className="px-2 py-2 text-right font-medium">Worst</th>
              <th className="px-2 py-2 text-right font-medium">Best</th>
              <th className="px-2 py-2 text-right font-medium">Net</th>
              <th className="px-2 py-2 text-right font-medium">Per $1 risked</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelected(t)}
                className={`cursor-pointer border-b border-panel-border/40 hover:bg-white/5 ${
                  !t.includedInRuleset ? "opacity-40" : ""
                }`}
              >
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">
                  {fmtDateTime(t.openedAt)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">
                  {fmtDateTime(t.closedAt)}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className={t.direction === "LONG" ? "text-accent" : "text-danger"}>
                    {t.direction}
                  </span>{" "}
                  <span className="text-muted">{INSTRUMENT_LABEL[t.symbol]}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{SESSION_LABEL[t.session]}</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{t.strategy}</td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{fmtPrice(t.entryPrice)}</td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{fmtPrice(t.exitPrice)}</td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">
                  {fmtHeld(t.openedAt, t.closedAt)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">{OUTCOME_LABEL[t.outcome]}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-muted">
                  {t.contracts != null ? `${t.contracts}x` : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-danger">
                  {fmtUsd(t.worstPoint, true)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-accent">
                  {fmtUsd(t.bestPoint, true)}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2 text-right font-mono text-xs ${
                    t.net >= 0 ? "text-accent" : "text-danger"
                  }`}
                >
                  {fmtUsd(t.net, true)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs text-muted">
                  {t.perDollarRisked.toFixed(2)}
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-panel-border bg-panel p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-sm">
                <span className={selected.direction === "LONG" ? "text-accent" : "text-danger"}>
                  {selected.direction}
                </span>{" "}
                {INSTRUMENT_LABEL[selected.symbol]}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-muted hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Session</dt>
              <dd className="text-right">{SESSION_LABEL[selected.session]}</dd>
              <dt className="text-muted">Strategy</dt>
              <dd className="text-right">{selected.strategy}</dd>
              <dt className="text-muted">Opened</dt>
              <dd className="text-right font-mono text-xs">{fmtDateTime(selected.openedAt)}</dd>
              <dt className="text-muted">Closed</dt>
              <dd className="text-right font-mono text-xs">{fmtDateTime(selected.closedAt)}</dd>
              <dt className="text-muted">Entry</dt>
              <dd className="text-right font-mono">{fmtPrice(selected.entryPrice)}</dd>
              <dt className="text-muted">Exit</dt>
              <dd className="text-right font-mono">{fmtPrice(selected.exitPrice)}</dd>
              <dt className="text-muted">Held</dt>
              <dd className="text-right font-mono">{fmtHeld(selected.openedAt, selected.closedAt)}</dd>
              <dt className="text-muted">Outcome</dt>
              <dd className="text-right">{OUTCOME_LABEL[selected.outcome]}</dd>
              <dt className="text-muted">Contracts</dt>
              <dd className="text-right font-mono">
                {selected.contracts != null ? selected.contracts : "unspecified (normalized risk calc)"}
              </dd>
              <dt className="text-muted">Worst point</dt>
              <dd className="text-right font-mono text-danger">{fmtUsd(selected.worstPoint, true)}</dd>
              <dt className="text-muted">Best point</dt>
              <dd className="text-right font-mono text-accent">{fmtUsd(selected.bestPoint, true)}</dd>
              <dt className="text-muted">Net</dt>
              <dd className={`text-right font-mono ${selected.net >= 0 ? "text-accent" : "text-danger"}`}>
                {fmtUsd(selected.net, true)}
              </dd>
              <dt className="text-muted">Per $1 risked</dt>
              <dd className="text-right font-mono">{selected.perDollarRisked.toFixed(2)}</dd>
              {!selected.includedInRuleset && (
                <dd className="col-span-2 mt-1 text-xs text-warn">
                  Hidden from the public record — outside the current ruleset. Not deleted.
                </dd>
              )}
            </dl>
          </div>
        </div>
      )}
    </Panel>
  );
}
