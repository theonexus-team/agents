"use client";

import { useState } from "react";
import { Panel } from "./Panel";

//: Must match backtest/strategies/__init__.py's STRATEGIES dict.
const STRATEGIES = ["orb_vwap", "algo2_first_touch"];
const SYMBOLS = ["MGC", "HG", "MNQ"];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

export function RunBacktestForm({
  deskKey,
  setDeskKey,
  onQueued,
}: {
  deskKey: string;
  setDeskKey: (key: string) => void;
  onQueued: () => void;
}) {
  const [strategy, setStrategy] = useState(STRATEGIES[0]);
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(25));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit() {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backtests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, strategy, symbol, timeframe: "1m", dateFrom, dateTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Couldn't queue that run.", error: true });
      } else {
        setMessage({
          text: `Queued — the scheduled worker checks every 10 minutes, so this'll update to "Completed" (or "Failed" with a reason) below within about that long.`,
          error: false,
        });
        onQueued();
      }
    } catch {
      setMessage({ text: "Network error queuing the run.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Run a new backtest"
      subtitle="Queues a run against whatever bars are already ingested locally — it doesn't run instantly. A scheduled task on your machine (theonexus-backtest-worker) picks up queued runs every 10 minutes and executes them, since the strategy engine only runs locally, not on Vercel."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="Strategy">
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="rounded border border-panel-border bg-black/20 px-2 py-1.5 text-sm text-foreground"
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instrument">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded border border-panel-border bg-black/20 px-2 py-1.5 text-sm text-foreground"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-panel-border bg-black/20 px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-panel-border bg-black/20 px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="Desk key">
          <input
            type="password"
            value={deskKey}
            onChange={(e) => setDeskKey(e.target.value)}
            placeholder="••••••••••••"
            className="w-40 rounded border border-panel-border bg-black/30 px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          {busy ? "Queuing…" : "Queue run"}
        </button>
      </div>
      {message && <p className={`mt-3 text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
