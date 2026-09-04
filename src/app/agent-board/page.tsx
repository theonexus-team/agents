"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { NotificationSetup } from "@/components/NotificationSetup";
import { fmtDateTime } from "@/lib/format";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

type Message = {
  id: string;
  createdAt: string;
  agent: string;
  message: string;
  url: string | null;
  replyTo: { agent: string; message: string } | null;
};

const AGENT_LABEL: Record<string, string> = {
  "risk-watchdog": "Risk Watchdog",
  "trading-analyst": "Trading Analyst",
  "instrument-scout": "Instrument Scout",
};

const AGENT_COLOR: Record<string, string> = {
  "risk-watchdog": "text-warn",
  "trading-analyst": "text-accent",
  "instrument-scout": "text-muted",
};

export default function AgentBoardPage() {
  const [deskKey, setDeskKeyState] = useState("");
  const [messages, setMessages] = useState<Message[] | null>(null);
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
      const res = await fetch(`/api/agent-board?deskKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) {
        setMessages(null);
        setError(res.status === 401 ? "invalid desk key" : `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { messages: Message[] };
      setMessages(json.messages);
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
        <Panel title="Agent Board" subtitle="Enter the desk key to view activity">
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Agent Board</h1>
        <button onClick={() => setDeskKey("")} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
          lock
        </button>
      </div>

      <p className="text-xs text-muted">
        Shared feed all three agents post to — Risk Watchdog, Trading Analyst, and Instrument Scout. A log to see
        everything in one place, not a task queue: nothing here triggers another agent automatically. Trading
        Analyst&apos;s Risk Manager step does read recent board activity (including Risk Watchdog&apos;s live
        status) as context for its own reasoning, so it&apos;s aware of what the other agents found — but that only
        informs its analysis, never bypasses review.
      </p>

      <NotificationSetup deskKey={deskKey} />

      {error && <Panel className="text-sm text-danger">{error}</Panel>}

      {messages === null && !error && <p className="text-sm text-muted">loading…</p>}

      {messages !== null && messages.length === 0 && <Panel className="text-sm text-muted">No activity yet.</Panel>}

      {messages && messages.length > 0 && (
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <Panel key={m.id} className={`text-sm ${m.replyTo ? "ml-6 border-l-2 border-l-panel-border/60" : ""}`}>
              {m.replyTo && (
                <div className="mb-2 rounded border border-panel-border/40 bg-black/20 px-2 py-1 text-xs text-muted">
                  ↳ replying to <span className={AGENT_COLOR[m.replyTo.agent] ?? ""}>{AGENT_LABEL[m.replyTo.agent] ?? m.replyTo.agent}</span>
                  {": "}
                  {m.replyTo.message.slice(0, 120)}
                  {m.replyTo.message.length > 120 ? "…" : ""}
                </div>
              )}
              <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide">
                <span className={AGENT_COLOR[m.agent] ?? "text-foreground"}>{AGENT_LABEL[m.agent] ?? m.agent}</span>
                <span className="text-muted">{fmtDateTime(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{m.message}</p>
              {m.url && (
                <Link href={m.url} className="mt-1 inline-block text-xs text-muted underline decoration-dotted hover:text-foreground">
                  view →
                </Link>
              )}
            </Panel>
          ))}
        </div>
      )}
    </main>
  );
}
