"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

// Same storage key the main dashboard uses — a desk key entered there auto-fills
// here too, and vice versa.
const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type AnalystRun = {
  id: string;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  tradesInWindow: number;
  analystFinding: string;
  riskVerdict: string;
  proposedDiff: string | null;
  status: string;
};

export default function AnalystPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [runs, setRuns] = useState<AnalystRun[] | null>(null);
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
      const res = await fetch(`/api/analyst-runs?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setRuns(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { runs: AnalystRun[] };
      setRuns(json.runs);
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
        <Panel title="Trading Analyst" subtitle="Enter the desk key to view findings">
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Trading Analyst</h1>
        <button
          onClick={() => setDeskKey("")}
          className="text-xs text-muted underline decoration-dotted hover:text-foreground"
        >
          lock
        </button>
      </div>

      {error && <Panel className="text-sm text-danger">{error}</Panel>}

      {runs === null && !error && <p className="text-sm text-muted">loading…</p>}

      {runs !== null && runs.length === 0 && (
        <Panel className="text-sm text-muted">No runs yet — the cron job fires weekdays after NY close.</Panel>
      )}

      {runs?.map((run) => (
        <Panel
          key={run.id}
          title={`${fmtDateTime(run.createdAt)} — ${run.status}`}
          subtitle={`window: ${fmtDateTime(run.windowStart)} → ${fmtDateTime(run.windowEnd)} · ${run.tradesInWindow} trades`}
        >
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Analyst</div>
              <p className="whitespace-pre-wrap text-foreground/90">{run.analystFinding}</p>
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Risk Manager</div>
              <p className="whitespace-pre-wrap text-foreground/90">{run.riskVerdict}</p>
            </div>
            {run.proposedDiff && (
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-warn">Proposed change (not applied)</div>
                <p className="whitespace-pre-wrap rounded-md border border-panel-border/60 bg-black/20 p-3 text-foreground/90">
                  {run.proposedDiff}
                </p>
              </div>
            )}
          </div>
        </Panel>
      ))}
    </main>
  );
}
