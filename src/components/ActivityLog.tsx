"use client";

import { useState } from "react";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { INSTRUMENT_LABEL, SESSION_LABEL, type DashboardData, type TradeRow } from "@/lib/types";
import { Panel } from "./Panel";
import { TradeLogTable } from "./TradeLogTable";

const SIGNAL_PAGE_SIZE = 10;

/** Trades and signals used to both render as separate always-expanded panels,
 * doubling up on page length since almost every signal has a matching trade once
 * it closes. Tabbed into one spot instead — only one list renders at a time. */
export function ActivityLog({ trades, signals }: { trades: TradeRow[]; signals: DashboardData["signals"] }) {
  const [tab, setTab] = useState<"trades" | "signals">("trades");

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button className="nx-tab" data-active={tab === "trades"} onClick={() => setTab("trades")}>
          Trade log ({trades.length})
        </button>
        <button className="nx-tab" data-active={tab === "signals"} onClick={() => setTab("signals")}>
          Signal feed ({signals.length})
        </button>
      </div>

      {tab === "trades" ? <TradeLogTable trades={trades} /> : <SignalFeed signals={signals} />}
    </div>
  );
}

function SignalFeed({ signals }: { signals: DashboardData["signals"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? signals : signals.slice(0, SIGNAL_PAGE_SIZE);

  return (
    <Panel title="Signal feed" subtitle="Each line is one setup the engine spotted and acted on, newest first.">
      {signals.length === 0 ? (
        <p className="text-sm text-muted">No signals yet.</p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((s) => (
            <li key={s.id} className="py-2.5 text-xs text-muted" style={{ boxShadow: "0 1px 0 var(--panel-border)" }}>
              <span className={s.direction === "LONG" ? "text-accent" : "text-danger"}>{s.direction}</span>{" "}
              {INSTRUMENT_LABEL[s.symbol]} · {SESSION_LABEL[s.session]} session · {fmtDateTime(s.occurredAt)}
              <br />
              in at {fmtPrice(s.entryPrice)} · stop {fmtPrice(s.stopPrice)} · target {fmtPrice(s.targetPrice)}
            </li>
          ))}
        </ul>
      )}
      {signals.length > SIGNAL_PAGE_SIZE && (
        <button onClick={() => setShowAll((v) => !v)} className="btn btn-ghost mt-3 px-0">
          {showAll ? "Show fewer" : `Show all ${signals.length} signals`}
        </button>
      )}
    </Panel>
  );
}
