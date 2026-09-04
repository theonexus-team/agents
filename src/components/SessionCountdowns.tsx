"use client";

import { useEffect, useState } from "react";
import { fmtCountdown } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { Panel } from "./Panel";

export function SessionCountdowns({ sessions }: { sessions: DashboardData["sessions"] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel title="Markets open in…" subtitle="Countdown to each session open the strategy trades. It only acts in the first two hours after an open.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sessions.map((s) => {
          const remaining = new Date(s.opensAt).getTime() - now;
          return (
            <div key={s.session} className="rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5 text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted">{s.label}</div>
              <div className="mt-1 font-mono text-xl text-accent">{fmtCountdown(remaining)}</div>
              <div className="mt-0.5 text-[10px] text-muted/70">opens in</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
