"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/types";
import { INSTRUMENT_LABEL } from "@/lib/types";
import { Panel } from "./Panel";

export function EngineControls({
  instruments,
  openPositionCount,
  maxLossBreached,
  liveExecutionMode,
  deskKey,
  setDeskKey,
  onChanged,
  onFlattenAll,
  accessToken,
}: {
  instruments: DashboardData["instruments"];
  openPositionCount: number;
  maxLossBreached: boolean;
  /** Primary dashboard only — whether entries/exits are being placed for real
   * through the local NinjaTrader watcher instead of recorded as paper trades. */
  liveExecutionMode: boolean;
  deskKey: string;
  setDeskKey: (key: string) => void;
  onChanged: () => void;
  onFlattenAll: (deskKey: string) => Promise<{ text: string; error: boolean }>;
  /** When set, every command targets this client account instead of the primary one. */
  accessToken?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmFlatten, setConfirmFlatten] = useState(false);
  const [confirmAckMaxLoss, setConfirmAckMaxLoss] = useState(false);
  const [confirmLiveExecution, setConfirmLiveExecution] = useState(false);

  async function send(scope: string, action: "pause" | "resume") {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    setBusy(`${scope}:${action}`);
    setMessage(null);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, scope, action, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Command rejected.", error: true });
      } else {
        setMessage({ text: `${scope} ${action} queued — waiting for the engine to check in.`, error: false });
        onChanged();
      }
    } catch {
      setMessage({ text: "Network error sending command.", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function acknowledgeMaxLoss() {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    if (!confirmAckMaxLoss) {
      setConfirmAckMaxLoss(true);
      return;
    }
    setConfirmAckMaxLoss(false);
    setBusy("maxloss:resume");
    setMessage(null);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, scope: "maxloss", action: "resume", accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Command rejected.", error: true });
      } else {
        setMessage({
          text: `Acknowledged — resumed with a fresh drawdown runway from current equity ($${Number(data.newPeakEquity).toLocaleString()}).`,
          error: false,
        });
        onChanged();
      }
    } catch {
      setMessage({ text: "Network error sending command.", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function toggleLiveExecution() {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    // Only confirm on the way IN — turning real order placement ON is the
    // consequential direction; turning it back OFF (back to paper) is always safe.
    if (!liveExecutionMode && !confirmLiveExecution) {
      setConfirmLiveExecution(true);
      return;
    }
    setConfirmLiveExecution(false);
    const nextAction = liveExecutionMode ? "pause" : "resume";
    setBusy(`liveExecution:${nextAction}`);
    setMessage(null);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, scope: "liveExecution", action: nextAction }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Command rejected.", error: true });
      } else {
        setMessage({
          text: liveExecutionMode
            ? "Real execution turned off — back to paper trades."
            : "Real execution turned on — entries/exits now route to the NinjaTrader watcher.",
          error: false,
        });
        onChanged();
      }
    } catch {
      setMessage({ text: "Network error sending command.", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function flattenAll() {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    if (!confirmFlatten) {
      setConfirmFlatten(true);
      return;
    }
    setConfirmFlatten(false);
    setBusy("flatten:all");
    setMessage(null);
    const result = await onFlattenAll(deskKey);
    setMessage(result);
    if (!result.error) onChanged();
    setBusy(null);
  }

  return (
    <Panel
      title="Engine controls"
      subtitle="Steering the engine needs the desk key — every command re-checks it server-side. Pausing blocks NEW trades only; any open position still runs to its stop or target unless you flatten it below."
    >
      {maxLossBreached && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-danger bg-danger/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-danger">
            Max drawdown breached — blocked account-wide until acknowledged.
          </span>
          <button
            onClick={acknowledgeMaxLoss}
            disabled={busy === "maxloss:resume"}
            className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              confirmAckMaxLoss
                ? "border-danger bg-danger/20 text-danger"
                : "border-danger/50 text-danger hover:bg-danger/10"
            }`}
          >
            {confirmAckMaxLoss ? "Confirm — resume with a fresh $2k runway?" : "Acknowledge & resume"}
          </button>
        </div>
      )}
      {!accessToken && (
        <div
          className={`mb-4 flex flex-col gap-2 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
            liveExecutionMode ? "border-warn bg-warn/10" : "border-panel-border/60 bg-black/20"
          }`}
        >
          <span className={`text-sm ${liveExecutionMode ? "text-warn" : "text-muted"}`}>
            {liveExecutionMode
              ? "REAL EXECUTION IS ON — entries/exits place actual orders through the NinjaTrader watcher."
              : "Paper trading — entries/exits are simulated, no real orders placed."}
          </span>
          <button
            onClick={toggleLiveExecution}
            disabled={busy === "liveExecution:pause" || busy === "liveExecution:resume"}
            className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              confirmLiveExecution
                ? "border-warn bg-warn/20 text-warn"
                : liveExecutionMode
                  ? "border-danger/50 text-danger hover:bg-danger/10"
                  : "border-warn/50 text-warn hover:bg-warn/10"
            }`}
          >
            {liveExecutionMode
              ? "Turn off — back to paper"
              : confirmLiveExecution
                ? "Confirm — start placing REAL orders?"
                : "Turn on real execution"}
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs uppercase tracking-wide text-muted" htmlFor="desk-key">
            Desk key
          </label>
          <input
            id="desk-key"
            type="password"
            value={deskKey}
            onChange={(e) => {
              setDeskKey(e.target.value);
              setConfirmFlatten(false);
              setConfirmAckMaxLoss(false);
            }}
            placeholder="••••••••••••"
            className="w-full max-w-xs rounded-md border border-panel-border bg-black/30 px-3 py-1.5 font-mono text-sm outline-none focus:border-accent"
          />
          {deskKey && (
            <button
              onClick={() => setDeskKey("")}
              className="text-[11px] text-muted underline decoration-dotted hover:text-foreground"
              title="Clears the saved desk key from this browser"
            >
              forget
            </button>
          )}
        </div>
        <button
          onClick={flattenAll}
          disabled={busy === "flatten:all" || openPositionCount === 0}
          className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
            confirmFlatten
              ? "border-danger bg-danger/20 text-danger"
              : "border-danger/50 text-danger hover:bg-danger/10"
          }`}
        >
          {openPositionCount === 0
            ? "Flatten all (nothing open)"
            : confirmFlatten
              ? `Confirm — close all ${openPositionCount} at market?`
              : `Flatten all (${openPositionCount} open)`}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ControlRow
          label={accessToken ? "This account" : "All instruments"}
          onPause={() => send("global", "pause")}
          onResume={() => send("global", "resume")}
          busy={busy}
          scope="global"
        />
        {/* Per-instrument pause is a fleet-wide admin kill switch, shared across every
            account — not something a client dashboard can target on its own. */}
        {!accessToken &&
          instruments.map((ins) => (
            <ControlRow
              key={ins.symbol}
              label={`${ins.symbol}${ins.paused ? " (paused)" : ""}`}
              title={INSTRUMENT_LABEL[ins.symbol]}
              onPause={() => send(ins.symbol, "pause")}
              onResume={() => send(ins.symbol, "resume")}
              busy={busy}
              scope={ins.symbol}
            />
          ))}
      </div>

      {message && (
        <p className={`mt-3 text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>
      )}
      <p className="mt-3 text-[11px] text-muted/70">
        Commands wait here until the engine checks in — usually under a minute. To hard-stop trading entirely,
        turn the strategy off inside TradingView.
      </p>
    </Panel>
  );
}

function ControlRow({
  label,
  title,
  onPause,
  onResume,
  busy,
  scope,
}: {
  label: string;
  title?: string;
  onPause: () => void;
  onResume: () => void;
  busy: string | null;
  scope: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-panel-border/60 bg-black/20 px-3 py-2">
      <span className="text-sm" title={title}>
        {label}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPause}
          disabled={busy === `${scope}:pause`}
          className="rounded border border-danger/50 px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          Pause
        </button>
        <button
          onClick={onResume}
          disabled={busy === `${scope}:resume`}
          className="rounded border border-accent/50 px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          Resume
        </button>
      </div>
    </div>
  );
}
