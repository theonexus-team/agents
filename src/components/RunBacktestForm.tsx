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
        <div className="field">
          <label htmlFor="bt-strat">Strategy</label>
          <select id="bt-strat" value={strategy} onChange={(e) => setStrategy(e.target.value)} className="input">
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bt-inst">Instrument</label>
          <select id="bt-inst" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input">
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bt-from">From</label>
          <input
            id="bt-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="bt-to">To</label>
          <input id="bt-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
        </div>
        <div className="field">
          <label htmlFor="bt-key">Desk key</label>
          <input
            id="bt-key"
            type="password"
            value={deskKey}
            onChange={(e) => setDeskKey(e.target.value)}
            placeholder="••••••••••••"
            className="input w-40"
          />
        </div>
        <button onClick={submit} disabled={busy} className="btn btn-primary">
          {busy ? "Queuing…" : "Queue run"}
        </button>
      </div>
      {message && <p className={`mt-3 text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
    </Panel>
  );
}
