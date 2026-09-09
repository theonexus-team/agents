"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCountdown } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

export function SessionCountdowns({ sessions }: { sessions: DashboardData["sessions"] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const withRemaining = useMemo(
    () => sessions.map((s) => ({ ...s, remaining: new Date(s.opensAt).getTime() - now })),
    [sessions, now]
  );
  const nextSession = withRemaining.reduce(
    (soonest, s) => (s.remaining < soonest.remaining ? s : soonest),
    withRemaining[0]
  );

  return (
    <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      {withRemaining.map((s) => {
        const active = s.session === nextSession?.session;
        return (
          <div
            key={s.session}
            className="rounded-[14px] p-4.5"
            style={
              active
                ? { background: "linear-gradient(160deg,#262a60 0%,#20233f 100%)", boxShadow: "0 0 0 1px #3a3f76" }
                : { background: "var(--panel)", boxShadow: "var(--shadow-sm)" }
            }
          >
            <div
              className="text-[11px] tracking-[0.14em] uppercase"
              style={{ color: active ? "#b9b4ea" : "var(--muted)" }}
            >
              {s.label}
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-semibold tracking-tight sm:text-[32px]">
              {fmtCountdown(s.remaining)}
            </div>
            <div className="mt-1.5 text-xs" style={{ color: active ? "#9a95c9" : "var(--muted)" }}>
              opens in
            </div>
          </div>
        );
      })}
    </section>
  );
}
