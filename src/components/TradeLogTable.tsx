"use client";

import { useState } from "react";
import { fmtDateTime, fmtHeld, fmtPrice, fmtUsd } from "@/lib/format";
import { INSTRUMENT_LABEL, OUTCOME_LABEL, SESSION_LABEL, type TradeRow } from "@/lib/types";
import { strategyDisplayName } from "@/lib/strategyNames";
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
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>Opened</th>
              <th>Closed</th>
              <th>Trade</th>
              <th>Session</th>
              <th>Strategy</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Held</th>
              <th>Outcome</th>
              <th className="text-right">Size</th>
              <th className="text-right">Worst</th>
              <th className="text-right">Best</th>
              <th className="text-right">Net</th>
              <th className="text-right">Per $1 risked</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelected(t)}
                className={`is-clickable ${!t.includedInRuleset ? "opacity-40" : ""}`}
              >
                <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(t.openedAt)}</td>
                <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(t.closedAt)}</td>
                <td className="whitespace-nowrap">
                  <span className={t.direction === "LONG" ? "text-accent" : "text-danger"}>{t.direction}</span>{" "}
                  <span className="text-muted">{INSTRUMENT_LABEL[t.symbol]}</span>
                </td>
                <td className="whitespace-nowrap text-xs text-muted">{SESSION_LABEL[t.session]}</td>
                <td className="whitespace-nowrap text-xs text-muted">{strategyDisplayName(t.strategy)}</td>
                <td className="whitespace-nowrap text-xs">{fmtPrice(t.entryPrice)}</td>
                <td className="whitespace-nowrap text-xs">{fmtPrice(t.exitPrice)}</td>
                <td className="whitespace-nowrap text-xs text-muted">{fmtHeld(t.openedAt, t.closedAt)}</td>
                <td className="whitespace-nowrap text-xs text-muted">{OUTCOME_LABEL[t.outcome]}</td>
                <td className="text-right text-xs whitespace-nowrap text-muted">
                  {t.contracts != null ? `${t.contracts}x` : "—"}
                </td>
                <td className="text-right text-xs whitespace-nowrap text-danger">{fmtUsd(t.worstPoint, true)}</td>
                <td className="text-right text-xs whitespace-nowrap text-accent">{fmtUsd(t.bestPoint, true)}</td>
                <td
                  className={`text-right text-xs font-medium whitespace-nowrap ${t.net >= 0 ? "text-accent" : "text-danger"}`}
                >
                  {fmtUsd(t.net, true)}
                </td>
                <td className="text-right text-xs whitespace-nowrap text-muted">{t.perDollarRisked.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > PAGE_SIZE && (
        <button onClick={() => setShowAll((v) => !v)} className="btn btn-ghost mt-3 px-0">
          {showAll ? "Show fewer" : `Show all ${trades.length} trades`}
        </button>
      )}

      {selected && (
        <div className="dialog-backdrop" onClick={() => setSelected(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="dialog-title">
                <span className={selected.direction === "LONG" ? "text-accent" : "text-danger"}>
                  {selected.direction}
                </span>{" "}
                {INSTRUMENT_LABEL[selected.symbol]}
              </h3>
              <button onClick={() => setSelected(null)} className="btn-icon text-muted hover:text-foreground" aria-label="Close">
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Session</dt>
              <dd className="text-right">{SESSION_LABEL[selected.session]}</dd>
              <dt className="text-muted">Strategy</dt>
              <dd className="text-right">{strategyDisplayName(selected.strategy)}</dd>
              <dt className="text-muted">Opened</dt>
              <dd className="text-right text-xs">{fmtDateTime(selected.openedAt)}</dd>
              <dt className="text-muted">Closed</dt>
              <dd className="text-right text-xs">{fmtDateTime(selected.closedAt)}</dd>
              <dt className="text-muted">Entry</dt>
              <dd className="text-right">{fmtPrice(selected.entryPrice)}</dd>
              <dt className="text-muted">Exit</dt>
              <dd className="text-right">{fmtPrice(selected.exitPrice)}</dd>
              <dt className="text-muted">Held</dt>
              <dd className="text-right">{fmtHeld(selected.openedAt, selected.closedAt)}</dd>
              <dt className="text-muted">Outcome</dt>
              <dd className="text-right">{OUTCOME_LABEL[selected.outcome]}</dd>
              <dt className="text-muted">Contracts</dt>
              <dd className="text-right">
                {selected.contracts != null ? selected.contracts : "unspecified (normalized risk calc)"}
              </dd>
              <dt className="text-muted">Worst point</dt>
              <dd className="text-right text-danger">{fmtUsd(selected.worstPoint, true)}</dd>
              <dt className="text-muted">Best point</dt>
              <dd className="text-right text-accent">{fmtUsd(selected.bestPoint, true)}</dd>
              <dt className="text-muted">Net</dt>
              <dd className={`text-right ${selected.net >= 0 ? "text-accent" : "text-danger"}`}>
                {fmtUsd(selected.net, true)}
              </dd>
              <dt className="text-muted">Per $1 risked</dt>
              <dd className="text-right">{selected.perDollarRisked.toFixed(2)}</dd>
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
