"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortfolioRunList } from "@/components/PortfolioRunList";
import type { PortfolioRunSummary } from "@/lib/types";

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<PortfolioRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portfolios", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: PortfolioRunSummary[]) => setPortfolios(json))
      .catch(() => setError("Couldn't load portfolio runs."));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href="/backtests" className="w-fit text-xs text-muted underline decoration-dotted hover:text-foreground">
          ← All backtests
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Portfolios</h1>
        <p className="text-xs text-muted">
          Multiple strategy legs run together on one shared account, with dynamic position sizing responding to the
          combined equity curve — not each strategy&apos;s backtest summed after the fact.
        </p>
      </header>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !portfolios && <p className="text-sm text-muted">Loading…</p>}
      {portfolios && <PortfolioRunList portfolios={portfolios} />}
    </main>
  );
}
