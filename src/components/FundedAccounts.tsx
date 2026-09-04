"use client";

import { useEffect, useState } from "react";
import { fmtUsd } from "@/lib/format";
import { Panel } from "./Panel";

type AccountSummary = {
  id: number;
  name: string;
  accountType: string;
  active: boolean;
  cashBalance: number;
  openPositions: { contractName: string; netPos: number; netPrice: number | null }[];
};

type ApiResponse = { configured: boolean; accounts: AccountSummary[]; error?: string };

export function FundedAccounts() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ configured: true, accounts: [], error: "Network error" });
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data || !data.configured) {
    return (
      <Panel title="Funded accounts" subtitle="Live balances and positions from Tradovate.">
        <p className="text-sm text-muted">
          Tradovate isn&apos;t connected yet — add your API credentials to{" "}
          <code className="rounded bg-black/30 px-1">.env</code> to pull real account data here.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Funded accounts" subtitle="Live balances and positions from Tradovate. Read-only — orders are never placed here.">
      {data.error && <p className="mb-2 text-xs text-danger">{data.error}</p>}
      {data.accounts.length === 0 && !data.error && (
        <p className="text-sm text-muted">No accounts returned.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {data.accounts.map((a) => (
          <div key={a.id} className="rounded-md border border-panel-border/60 bg-black/20 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm">{a.name}</span>
              <span className={`text-[11px] ${a.active ? "text-accent" : "text-muted"}`}>
                {a.active ? "active" : "inactive"} · {a.accountType}
              </span>
            </div>
            <div className="font-mono text-lg">{fmtUsd(a.cashBalance)}</div>
            {a.openPositions.length === 0 ? (
              <div className="mt-1 text-[11px] text-muted/70">flat</div>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {a.openPositions.map((p, i) => (
                  <li key={i} className="text-[11px] text-muted">
                    {p.netPos > 0 ? "LONG" : "SHORT"} {Math.abs(p.netPos)} {p.contractName}
                    {p.netPrice ? ` @ ${p.netPrice}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
