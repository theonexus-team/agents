"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type OverallRow = {
  id: string;
  strategy: string;
  instrumentSymbol: string;
  timeframe: string;
  dataStart: string;
  dataEnd: string;
  trades: number;
  winRate: number;
  net: number;
  maxDrawdown: number;
};

type SessionRow = {
  runId: string;
  strategy: string;
  instrumentSymbol: string;
  timeframe: string;
  session: string;
  trades: number;
  winRate: number;
  net: number;
  maxDrawdown: number;
};

function ResultsTable({ rows, showTimeframe, showSession }: { rows: (OverallRow | SessionRow)[]; showTimeframe: boolean; showSession: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted">
            <th className="pb-2 pr-4">Instrument</th>
            <th className="pb-2 pr-4">Strategy</th>
            {showTimeframe && <th className="pb-2 pr-4">Timeframe</th>}
            {showSession && <th className="pb-2 pr-4">Session</th>}
            <th className="pb-2 pr-4">Trades</th>
            <th className="pb-2 pr-4">Win Rate</th>
            <th className="pb-2 pr-4">Net</th>
            <th className="pb-2">Max Drawdown</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={"session" in r ? `${r.runId}-${r.session}` : r.id} className={i === 0 ? "border-t border-panel-border/40" : "border-t border-panel-border/40"}>
              <td className="py-2 pr-4 font-mono">{r.instrumentSymbol}</td>
              <td className="py-2 pr-4">{r.strategy}</td>
              {showTimeframe && <td className="py-2 pr-4">{r.timeframe}</td>}
              {showSession && "session" in r && <td className="py-2 pr-4">{r.session}</td>}
              <td className="py-2 pr-4">{r.trades}</td>
              <td className="py-2 pr-4">{r.winRate.toFixed(1)}%</td>
              <td className={`py-2 pr-4 ${r.net >= 0 ? "text-accent" : "text-danger"}`}>${r.net.toFixed(2)}</td>
              <td className="py-2">${r.maxDrawdown.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InstrumentScoutPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [overall, setOverall] = useState<OverallRow[] | null>(null);
  const [bySession, setBySession] = useState<SessionRow[] | null>(null);
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
        setOverall(null);
        setBySession(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { overall: OverallRow[]; bySession: SessionRow[] };
      setOverall(json.overall);
      setBySession(json.bySession);
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

      {overall === null && !error && <p className="text-sm text-muted">loading…</p>}

      {overall !== null && overall.length === 0 && (
        <Panel className="text-sm text-muted">No scout runs yet — run <code>backtest/scout.py</code> to populate this.</Panel>
      )}

      {bySession && bySession.length > 0 && (
        <Panel title="By session" subtitle="Same instrument + strategy + timeframe combo can look very different session to session — same pattern as the live account.">
          <ResultsTable rows={bySession} showTimeframe={true} showSession={true} />
        </Panel>
      )}

      {overall && overall.length > 0 && (
        <Panel title="Overall (all sessions combined)">
          <ResultsTable rows={overall} showTimeframe={true} showSession={false} />
        </Panel>
      )}

      {overall && overall.length > 0 && (
        <p className="text-xs text-muted">
          Data window per run shown on hover of the run — earliest: {fmtDateTime(overall[overall.length - 1]?.dataStart)}, latest:{" "}
          {fmtDateTime(overall[0]?.dataEnd)}.
        </p>
      )}
    </main>
  );
}
