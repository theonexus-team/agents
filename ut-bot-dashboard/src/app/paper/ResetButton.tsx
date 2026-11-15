"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Clears the paper account back to its starting balance (positions + trade history). */
export default function ResetButton({ start }: { start: number }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  async function reset() {
    setBusy(true);
    await fetch("/api/paper/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ starting_balance: start }) });
    setBusy(false); setConfirming(false); router.refresh();
  }
  if (!confirming) return <button className="rounded border border-line px-3 py-1.5 text-sm" onClick={() => setConfirming(true)}>Reset account</button>;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Clear all positions and trades, back to ${start.toFixed(0)}?</span>
      <button className="rounded bg-sell px-3 py-1.5 text-white" disabled={busy} onClick={reset}>{busy ? "Resetting…" : "Yes, reset"}</button>
      <button className="rounded border border-line px-3 py-1.5" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}
