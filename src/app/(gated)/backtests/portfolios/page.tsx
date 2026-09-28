"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortfolioRunList } from "@/components/PortfolioRunList";
import { SiteHeader } from "@/components/SiteHeader";
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
    <>
      <SiteHeader status={{ label: "Backtests", tone: "neutral" }} />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <Link href="/backtests" className="nx-tab w-fit px-0">
            ← All backtests
          </Link>
          <h1 className="m-0 mt-1 mb-1 text-[26px] font-medium text-foreground">Portfolios</h1>
          <p className="m-0 text-xs text-muted">
            Multiple strategy legs run together on one shared account, with dynamic position sizing responding to the
            combined equity curve — not each strategy&apos;s backtest summed after the fact.
          </p>
        </header>

        {error && <p className="text-sm text-danger">{error}</p>}
        {!error && !portfolios && <p className="text-sm text-muted">Loading…</p>}
        {portfolios && <PortfolioRunList portfolios={portfolios} />}
      </main>
    </>
  );
}
