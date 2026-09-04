"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { NotificationSetup } from "@/components/NotificationSetup";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type Proposal = {
  id: string;
  createdAt: string;
  title: string;
  gapFound: string;
  proposal: string;
  status: string;
};

const STATUS_COLOR: Record<string, string> = {
  proposed: "text-warn",
  built: "text-accent",
  dismissed: "text-muted",
};

export default function AgentProposalsPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
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
      const res = await fetch(`/api/agent-proposals?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setProposals(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { proposals: Proposal[] };
      setProposals(json.proposals);
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
        <Panel title="Team Planner" subtitle="Enter the desk key to view proposals">
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
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Team Planner</h1>
        <button onClick={() => setDeskKey("")} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
          lock
        </button>
      </div>

      <p className="text-xs text-muted">
        Runs weekly — reviews everything the other agents and the board have surfaced, and proposes a new agent when
        it finds a real, concrete gap. Advisory only: it writes a proposal here, it never writes or deploys code
        itself. Nothing gets built until a human (or Claude Code) reads a proposal and decides.
      </p>

      <NotificationSetup deskKey={deskKey} />

      {error && <Panel className="text-sm text-danger">{error}</Panel>}
      {proposals === null && !error && <p className="text-sm text-muted">loading…</p>}
      {proposals !== null && proposals.length === 0 && (
        <Panel className="text-sm text-muted">No proposals yet — the cron job fires weekly.</Panel>
      )}

      {proposals?.map((p) => (
        <Panel
          key={p.id}
          title={p.title}
          subtitle={fmtDateTime(p.createdAt)}
          className={p.status === "proposed" ? "border-warn/60" : ""}
        >
          <div className="flex flex-col gap-3 text-sm">
            <div className={`text-[11px] uppercase tracking-wide ${STATUS_COLOR[p.status] ?? "text-muted"}`}>{p.status}</div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Gap found</div>
              <p className="whitespace-pre-wrap text-foreground/90">{p.gapFound}</p>
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Full proposal</div>
              <p className="whitespace-pre-wrap rounded-md border border-panel-border/60 bg-black/20 p-3 text-foreground/90">
                {p.proposal}
              </p>
            </div>
          </div>
        </Panel>
      ))}
    </main>
  );
}
