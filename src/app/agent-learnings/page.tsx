"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type Learning = { id: string; createdAt: string; agent: string; category: string; lesson: string; active: boolean };

const AGENT_LABEL: Record<string, string> = {
  "risk-watchdog": "Risk Watchdog",
  "trading-analyst": "Trading Analyst",
  "instrument-scout": "Instrument Scout",
  shared: "Shared",
};

export default function AgentLearningsPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [learnings, setLearnings] = useState<Learning[] | null>(null);
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
      const res = await fetch(`/api/agent-learnings?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setLearnings(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { learnings: Learning[] };
      setLearnings(json.learnings);
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
        <Panel title="Agent Learnings" subtitle="Enter the desk key to view">
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

  const active = learnings?.filter((l) => l.active) ?? [];
  const retired = learnings?.filter((l) => !l.active) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Agent Learnings</h1>
        <button onClick={() => setDeskKey("")} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
          lock
        </button>
      </div>

      <p className="text-xs text-muted">
        Standing rules the agents read BEFORE acting, not just a log — this is the actual &quot;getting smarter over
        time&quot; piece. Trading Analyst&apos;s Analyst and Risk Manager steps both read the active list here on
        every run, so a mistake found once doesn&apos;t get silently re-made.
      </p>

      {error && <Panel className="text-sm text-danger">{error}</Panel>}
      {learnings === null && !error && <p className="text-sm text-muted">loading…</p>}
      {learnings !== null && learnings.length === 0 && <Panel className="text-sm text-muted">No learnings recorded yet.</Panel>}

      {active.length > 0 && (
        <Panel title="Active">
          <div className="flex flex-col gap-3">
            {active.map((l) => (
              <div key={l.id} className="border-b border-panel-border/40 pb-3 last:border-0 text-sm">
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
                  <span className="text-accent">{AGENT_LABEL[l.agent] ?? l.agent}</span>
                  <span>·</span>
                  <span>{l.category}</span>
                  <span className="ml-auto">{fmtDateTime(l.createdAt)}</span>
                </div>
                <p className="text-foreground/90">{l.lesson}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {retired.length > 0 && (
        <Panel title="Retired" subtitle="Superseded, kept for history">
          <div className="flex flex-col gap-3">
            {retired.map((l) => (
              <div key={l.id} className="border-b border-panel-border/40 pb-3 last:border-0 text-sm opacity-60">
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
                  <span>{AGENT_LABEL[l.agent] ?? l.agent}</span>
                  <span>·</span>
                  <span>{l.category}</span>
                  <span className="ml-auto">{fmtDateTime(l.createdAt)}</span>
                </div>
                <p className="text-foreground/90 line-through">{l.lesson}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </main>
  );
}
