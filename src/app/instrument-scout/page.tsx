"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type ScoutResult = {
  id: string;
  strategy: string;
  instrumentSymbol: string;
  timeframe: string;
  dataStart: string;
  dataEnd: string;
  createdAt: string;
  trades: number;
  winRate: number;
  net: number;
  maxDrawdown: number;
};

export default function InstrumentScoutPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [results, setResults] = useState<ScoutResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(DESK_KEY_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDeskKeyState(saved);
  }, []);

  const setDeskKey = useCallback((key: string) => {
    setDeskKeyState(key);
    if (key) localStorage.setItem(DESK_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(DESK_KEY_STORAGE_KEY);
  }, []);

  const load = useCallback(async (key: string) => {
    if (!key) return;
    setError(null);
    try {
      const res = await fetch(`/api/instrument-scout?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setResults(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { results: ScoutResult[] };
      setResults(json.results);
    } catch {
      setError("failed to load");
    }
  }, []);

  useEffect(() => {
    if (deskKey) load(deskKey);
  }, [deskKey, load]);

  if (!deskKey) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
        <Panel title="Instrument Scout" subtitle="Enter the desk key to view results">
          <input
            type="password"
            placeholder="Desk key"
            className="w-full rounded-md border border-panel-border bg-black/20 px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") setDeskKey((e.target as HTMLInputElement).value);
            }}
          />
        </Panel>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Instrument Scout</h1>
        <button onClick={() => setDeskKey("")} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
          lock
        </button>
      </div>

      <p className="text-xs text-muted">
        Backtest of the two live strategies (ORB+VWAP, Algo 2) against instruments not currently traded — run locally
        via <code>backtest/scout.py</code>, not a live agent, since the price history it needs lives on this machine,
        not in the cloud. Re-run manually for fresh results.
      </p>

      {error && <Panel className="text-sm text-danger">{error}</Panel>}

      {results === null && !error && <p className="text-sm text-muted">loading…</p>}

      {results !== null && results.length === 0 && (
        <Panel className="text-sm text-muted">No scout runs yet — run <code>backtest/scout.py</code> to populate this.</Panel>
      )}

      {results && results.length > 0 && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-4">Instrument</th>
                  <th className="pb-2 pr-4">Strategy</th>
                  <th className="pb-2 pr-4">Timeframe</th>
                  <th className="pb-2 pr-4">Trades</th>
                  <th className="pb-2 pr-4">Win Rate</th>
                  <th className="pb-2 pr-4">Net</th>
                  <th className="pb-2 pr-4">Max Drawdown</th>
                  <th className="pb-2">Data Window</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-panel-border/40">
                    <td className="py-2 pr-4 font-mono">{r.instrumentSymbol}</td>
                    <td className="py-2 pr-4">{r.strategy}</td>
                    <td className="py-2 pr-4">{r.timeframe}</td>
                    <td className="py-2 pr-4">{r.trades}</td>
                    <td className="py-2 pr-4">{r.winRate.toFixed(1)}%</td>
                    <td className={`py-2 pr-4 ${r.net >= 0 ? "text-accent" : "text-danger"}`}>${r.net.toFixed(2)}</td>
                    <td className="py-2 pr-4">${r.maxDrawdown.toFixed(2)}</td>
                    <td className="py-2 text-xs text-muted">
                      {fmtDateTime(r.dataStart)} → {fmtDateTime(r.dataEnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
