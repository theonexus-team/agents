"use client";

import { useState } from "react";
import { Panel } from "./Panel";

export function KalshiControls({
  paused,
  killSwitch,
  killSwitchReason,
  hasOpenPosition,
  deskKey,
  setDeskKey,
  onChanged,
}: {
  paused: boolean;
  killSwitch: boolean;
  killSwitchReason: string | null;
  hasOpenPosition: boolean;
  deskKey: string;
  setDeskKey: (key: string) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmFlatten, setConfirmFlatten] = useState(false);

  async function send(action: "pause" | "resume" | "flatten" | "ackKillSwitch") {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/kalshi/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Command rejected.", error: true });
      } else {
        setMessage({ text: data.note ?? `${action} sent — waiting for the bot to check in.`, error: false });
        onChanged();
      }
    } catch {
      setMessage({ text: "Network error sending command.", error: true });
    } finally {
      setBusy(null);
    }
  }

  function flatten() {
    if (!confirmFlatten) {
      setConfirmFlatten(true);
      return;
    }
    setConfirmFlatten(false);
    send("flatten");
  }

  return (
    <Panel
      title="Kalshi bot controls"
      subtitle="Every command here just sets a flag — only the local bot process holds actual Kalshi order authority, so effects land within its poll interval (a few seconds), not instantly."
    >
      {killSwitch && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-danger bg-danger/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-danger">
            Kill switch tripped{killSwitchReason ? `: ${killSwitchReason}` : ""}. New trades blocked until acknowledged.
          </span>
          <button
            onClick={() => send("ackKillSwitch")}
            disabled={busy === "ackKillSwitch"}
            className="rounded border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-40"
          >
            Acknowledge & clear
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs uppercase tracking-wide text-muted" htmlFor="kalshi-desk-key">
            Desk key
          </label>
          <input
            id="kalshi-desk-key"
            type="password"
            value={deskKey}
            onChange={(e) => setDeskKey(e.target.value)}
            placeholder="••••••••••••"
            className="w-full max-w-xs rounded-md border border-panel-border bg-black/30 px-3 py-1.5 font-mono text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2">
          {paused ? (
            <button
              onClick={() => send("resume")}
              disabled={busy === "resume"}
              className="rounded border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={() => send("pause")}
              disabled={busy === "pause"}
              className="rounded border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-40"
            >
              Pause
            </button>
          )}
          <button
            onClick={flatten}
            disabled={busy === "flatten" || !hasOpenPosition}
            className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              confirmFlatten ? "border-danger bg-danger/20 text-danger" : "border-danger/50 text-danger hover:bg-danger/10"
            }`}
          >
            {!hasOpenPosition ? "Flatten (nothing open)" : confirmFlatten ? "Confirm — close at market?" : "Flatten"}
          </button>
        </div>
      </div>

      {message && <p className={`text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
    </Panel>
  );
}
