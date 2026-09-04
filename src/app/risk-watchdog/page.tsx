"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, StatTile } from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type Status = {
  checkedAt: string;
  currentEquity: number;
  peakEquity: number;
  drawdownFromPeak: number;
  drawdownPct: number;
  dailyPnl: number;
  dailyLossPct: number;
  level: "OK" | "WARNING" | "BREACH";
  message: string;
};

type Alert = { id: string; createdAt: string; level: string; message: string };

const LEVEL_COLOR: Record<string, string> = {
  OK: "text-accent",
  WARNING: "text-warn",
  BREACH: "text-danger",
};

export default function RiskWatchdogPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [status, setStatus] = useState<Status | null | undefined>(undefined);
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
      const res = await fetch(`/api/risk-watchdog?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setStatus(undefined);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { status: Status | null; alerts: Alert[] };
      setStatus(json.status);
      setAlerts(json.alerts);
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
        <Panel title="Risk Watchdog" subtitle="Enter the desk key to view status">
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
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Risk Watchdog</h1>
        <button onClick={() => setDeskKey("")} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
          lock
        </button>
      </div>

      {error && <Panel className="text-sm text-danger">{error}</Panel>}

      {status === undefined && !error && <p className="text-sm text-muted">loading…</p>}

      {status === null && !error && (
        <Panel className="text-sm text-muted">No checks yet — the cron job hasn&apos;t fired for the first time.</Panel>
      )}

      {status && (
        <Panel
          title={`Status: ${status.level}`}
          subtitle={`last checked ${fmtDateTime(status.checkedAt)}`}
          className={status.level === "BREACH" ? "border-danger/60" : status.level === "WARNING" ? "border-warn/60" : ""}
        >
          <p className={`mb-3 text-sm ${LEVEL_COLOR[status.level] ?? "text-foreground"}`}>{status.message}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Current Equity" value={`$${status.currentEquity.toFixed(2)}`} />
            <StatTile label="Peak Equity" value={`$${status.peakEquity.toFixed(2)}`} />
            <StatTile label="Drawdown from Peak" value={`$${status.drawdownFromPeak.toFixed(2)}`} sub={`${status.drawdownPct.toFixed(0)}% of limit`} />
            <StatTile label="Today's P&L" value={`$${status.dailyPnl.toFixed(2)}`} sub={`${status.dailyLossPct.toFixed(0)}% of daily limit`} />
          </div>
        </Panel>
      )}

      <Panel title="Recent Alerts" subtitle="Only logged when the level actually changes, not every check">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">No level changes recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 border-b border-panel-border/40 pb-2 last:border-0">
                <span className={LEVEL_COLOR[a.level] ?? "text-foreground"}>
                  {a.level} — {fmtDateTime(a.createdAt)}
                </span>
                <span className="text-foreground/80">{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
