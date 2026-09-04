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
        <TabButton active={tab === "trades"} onClick={() => setTab("trades")}>
          Trade log ({trades.length})
        </TabButton>
        <TabButton active={tab === "signals"} onClick={() => setTab("signals")}>
          Signal feed ({signals.length})
        </TabButton>
      </div>

      {tab === "trades" ? <TradeLogTable trades={trades} /> : <SignalFeed signals={signals} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-panel-border/60 text-muted hover:bg-white/5"
      }`}
    >
      {children}
    </button>
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
        <ul className="flex flex-col gap-1.5 text-sm">
          {visible.map((s) => (
            <li key={s.id} className="text-xs text-muted">
              <span className={s.direction === "LONG" ? "text-accent" : "text-danger"}>{s.direction}</span>{" "}
              {INSTRUMENT_LABEL[s.symbol]} · {SESSION_LABEL[s.session]} session · {fmtDateTime(s.occurredAt)}
              <br />
              in at {fmtPrice(s.entryPrice)} · stop {fmtPrice(s.stopPrice)} · target {fmtPrice(s.targetPrice)}
            </li>
          ))}
        </ul>
      )}
      {signals.length > SIGNAL_PAGE_SIZE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs text-muted underline decoration-dotted hover:text-foreground"
        >
          {showAll ? "Show fewer" : `Show all ${signals.length} signals`}
        </button>
      )}
    </Panel>
  );
}
