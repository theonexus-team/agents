"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/types";
import { INSTRUMENT_LABEL } from "@/lib/types";

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
    <section
      className="rounded-[14px] p-5"
      style={{ background: "linear-gradient(150deg,#20233a 0%,#1a1c2c 100%)", boxShadow: "0 0 0 1px #3f424d" }}
    >
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h4 className="m-0 text-[15px] font-medium text-foreground">Engine controls</h4>
        <span className="mr-auto text-xs text-muted">
          Desk key required for any action. Pausing blocks new trades only — open positions still run to stop/target
          unless flattened.
        </span>
      </div>

      {maxLossBreached && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-danger bg-danger/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-danger">Max drawdown breached — blocked account-wide until acknowledged.</span>
          <button
            onClick={acknowledgeMaxLoss}
            disabled={busy === "maxloss:resume"}
            className={confirmAckMaxLoss ? "btn btn-danger-solid" : "btn btn-danger"}
          >
            {confirmAckMaxLoss ? "Confirm — resume with a fresh $2k runway?" : "Acknowledge & resume"}
          </button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="field mb-3.5">
            <label htmlFor="desk-key">Desk key</label>
            <div className="flex items-center gap-2">
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
                className="input max-w-xs"
              />
              {deskKey && (
                <button
                  onClick={() => setDeskKey("")}
                  className="text-[11px] whitespace-nowrap text-muted underline decoration-dotted hover:text-foreground"
                  title="Clears the saved desk key from this browser"
                >
                  forget
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={flattenAll}
              disabled={busy === "flatten:all" || openPositionCount === 0}
              className={confirmFlatten ? "btn btn-danger-solid" : "btn btn-danger"}
            >
              {openPositionCount === 0
                ? "Flatten all (nothing open)"
                : confirmFlatten
                  ? `Confirm — close all ${openPositionCount} at market?`
                  : `Flatten all (${openPositionCount} open)`}
            </button>
            <button onClick={() => send("global", "pause")} disabled={busy === "global:pause"} className="btn btn-secondary">
              Pause all
            </button>
          </div>

          {!accessToken && (
            <div
              className="mt-4.5 rounded-[10px] p-3.5"
              style={{ border: "1px solid #7a5a24", background: "rgba(230,181,103,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: "#e6b567" }}>
                    {liveExecutionMode ? "Real execution is on" : "Turn on real execution"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {liveExecutionMode
                      ? "Entries/exits place actual orders through the NinjaTrader watcher."
                      : "Routes orders to funded accounts. Irreversible for the session."}
                  </div>
                </div>
                <button
                  onClick={toggleLiveExecution}
                  disabled={busy === "liveExecution:pause" || busy === "liveExecution:resume"}
                  role="switch"
                  aria-checked={liveExecutionMode}
                  type="button"
                  className="flex h-[26px] w-[46px] flex-none items-center rounded-full p-[3px]"
                  style={{
                    justifyContent: liveExecutionMode ? "flex-end" : "flex-start",
                    border: `1px solid ${liveExecutionMode ? "#e6b567" : "var(--nx-neutral-600)"}`,
                    background: liveExecutionMode ? "rgba(230,181,103,0.28)" : "transparent",
                  }}
                >
                  <span
                    className="h-[18px] w-[18px] rounded-full"
                    style={{ background: liveExecutionMode ? "#e6b567" : "var(--nx-neutral-500)" }}
                  />
                </button>
              </div>
              {confirmLiveExecution && (
                <p className="mt-2 text-xs" style={{ color: "#e6b567" }}>
                  Click again to confirm — this starts placing real orders.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
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
      </div>

      {message && <p className={`mt-4 text-xs ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
      <p className="mt-3 text-[11px] text-muted/70">
        Commands wait here until the engine checks in — usually under a minute. To hard-stop trading entirely, turn
        the strategy off inside TradingView.
      </p>
    </section>
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
    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-black/20 px-3.5 py-2.5">
      <span className="text-sm" title={title}>
        {label}
      </span>
      <div className="flex gap-2">
        <button onClick={onPause} disabled={busy === `${scope}:pause`} className="btn btn-danger">
          Pause
        </button>
        <button onClick={onResume} disabled={busy === `${scope}:resume`} className="btn btn-primary">
          Resume
        </button>
      </div>
    </div>
  );
}
