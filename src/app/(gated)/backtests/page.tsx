"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BacktestRunList } from "@/components/BacktestRunList";
import { RunBacktestForm } from "@/components/RunBacktestForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { BacktestRunSummary } from "@/lib/types";

const DESK_KEY_STORAGE_KEY = "theonexus_desk_key";

export default function BacktestsPage() {
  const [runs, setRuns] = useState<BacktestRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deskKey, setDeskKeyState] = useState("");

  // Same storage key the live desk uses — entering it once on either page fills it
  // in on both.
  useEffect(() => {
    const saved = localStorage.getItem(DESK_KEY_STORAGE_KEY);
    if (saved) setDeskKeyState(saved);
  }, []);

  const setDeskKey = useCallback((key: string) => {
    setDeskKeyState(key);
    if (key) {
      localStorage.setItem(DESK_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(DESK_KEY_STORAGE_KEY);
    }
  }, []);

  const load = useCallback(() => {
    fetch("/api/backtests", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: BacktestRunSummary[]) => setRuns(json))
      .catch(() => setError("Couldn't load backtest runs."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <SiteHeader status={{ label: "Backtests", tone: "neutral" }} />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="m-0 mb-1 text-[28px] font-medium text-foreground sm:text-[34px]">Backtests</h1>
              <p className="m-0 text-xs text-muted">
                Historical and forward-test runs across every strategy — not the live paper-trading record above.
              </p>
            </div>
            <Link href="/backtests/portfolios" className="nx-tab">
              Portfolios →
            </Link>
          </div>
        </header>

        <RunBacktestForm deskKey={deskKey} setDeskKey={setDeskKey} onQueued={load} />

        {error && <p className="text-sm text-danger">{error}</p>}
        {!error && !runs && <p className="text-sm text-muted">Loading…</p>}
        {runs && <BacktestRunList runs={runs} />}
      </main>
    </>
  );
}
