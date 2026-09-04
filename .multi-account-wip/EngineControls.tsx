"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/types";
import { INSTRUMENT_LABEL } from "@/lib/types";
import { Panel } from "./Panel";

export function EngineControls({
  instruments,
  openPositionCount,
  maxLossBreached,
  accountName,
  accessToken,
  deskKey,
  setDeskKey,
  onChanged,
  onFlattenAll,
}: {
  instruments: DashboardData["instruments"];
  openPositionCount: number;
  maxLossBreached: boolean;
  accountName: string;
  accessToken: string;
  deskKey: string;
  setDeskKey: (key: string) => void;
  onChanged: () => void;
  onFlattenAll: (deskKey: string) => Promise<{ text: string; error: boolean }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmFlatten, setConfirmFlatten] = useState(false);
  const [confirmAckMaxLoss, setConfirmAckMaxLoss] = useState(false);

  /** Pause/resume THIS account only — takes either this account's own scoped desk
   * key or the main admin key. */
  async function sendAccountCommand(scope: "global" | "maxloss", action: "pause" | "resume") {
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
        setMessage({ text: `${action === "pause" ? "Paused" : "Resumed"} this account.`, error: false });
        onChanged();
      }
    } catch {
      setMessage({ text: "Network error sending command.", error: true });
    } finally {
      setBusy(null);
    }
  }

  /** Pause/resume one instrument, admin-only — shared across every account, not
   * scoped to this one. Requires the real admin desk key; a client's own scoped
   * key is rejected here even though it works for their own account above. */
  async function sendAdminCommand(symbol: string, action: "pause" | "resume") {
    if (!deskKey) {
      setMessage({ text: "Enter the desk key first.", error: true });
      return;
    }
    setBusy(`${symbol}:${action}`);
    setMessage(null);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskKey, scope: symbol, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Command rejected — admin key required.", error: true });
      } else {
        setMessage({ text: `${symbol} ${action}d for every account.`, error: false });
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
      subtitle="Steering this account needs its desk key (or the admin key) — every command re-checks it server-side. Pausing blocks NEW trades only; any open position still runs to its stop or target unless you flatten it below."
    >
      {maxLossBreached && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-danger bg-danger/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-danger">
            Max drawdown breached — blocked until acknowledged.
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
            {confirmAckMaxLoss ? "Confirm — resume with a fresh runway?" : "Acknowledge & resume"}
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
          label={`This account (${accountName})`}
          onPause={() => sendAccountCommand("global", "pause")}
          onResume={() => sendAccountCommand("global", "resume")}
          busy={busy}
          scope="global"
        />
      </div>

      <p className="mt-4 mb-2 text-[11px] uppercase tracking-wide text-muted">
        Instrument pause — admin key only, affects every account
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {instruments.map((ins) => (
          <ControlRow
            key={ins.symbol}
            label={`${ins.symbol}${ins.paused ? " (paused)" : ""}`}
            title={INSTRUMENT_LABEL[ins.symbol]}
            onPause={() => sendAdminCommand(ins.symbol, "pause")}
            onResume={() => sendAdminCommand(ins.symbol, "resume")}
            busy={busy}
            scope={ins.symbol}
          />
        ))}
      </div>

      {message && (
        <p className={`mt-3 text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>
      )}
      <p className="mt-3 text-[11px] text-muted/70">
        Commands apply immediately. To hard-stop trading entirely, turn the strategy off inside TradingView.
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
