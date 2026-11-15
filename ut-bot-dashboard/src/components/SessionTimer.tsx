"use client";
import { useEffect, useState } from "react";
import { getSessionState, type SessionState } from "@/lib/session";

// Bar spans 9:30–16:00 (390 min). Opening = 0–90, power hour = 330–390.
export default function SessionTimer({ lastWebhook }: { lastWebhook: string | null }) {
  const [s, setS] = useState<SessionState | null>(null);
  useEffect(() => {
    setS(getSessionState());
    const t = setInterval(() => setS(getSessionState()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!s) return <div className="card h-[92px]" />;
  const live = s.alertsLive;
  const recent = lastWebhook && Date.now() - new Date(lastWebhook).getTime() < 10 * 60_000 && live;
  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${recent ? "bg-buy" : "bg-muted/50"}`} title={recent ? "Webhook in the last 10 min" : "Idle"} />
          <div>
            <div className={`text-sm font-semibold ${live ? "text-buy" : "text-muted"}`}>{s.label}</div>
            <div className="text-[11px] text-muted">{live ? "Trading window 7:00 AM–3:00 PM ET · alerts live · signal-to-signal paper trades" : s.phase === "power" ? "Power hour: signals logged, not traded" : "Trading runs 7:00 AM–3:00 PM ET"}</div>
          </div>
        </div>
        <div className="flex gap-2 text-[11px]">
          <span className={`rounded px-2 py-0.5 ${live ? "bg-buy/15 text-buy" : "bg-panel-2 text-muted"}`}>Alerts {live ? "LIVE" : "OFF"}</span>
          <span className="rounded bg-panel-2 px-2 py-0.5 text-muted">Webhook · last signal {lastWebhook ? new Date(lastWebhook).toLocaleTimeString("en-US", { timeZone: "America/New_York" }) + " ET" : "none yet"}</span>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-panel-2">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-buy/70" style={{ width: `${(90 / 390) * 100}%` }} />
        {!s.earlyClose && <div className="absolute inset-y-0 right-0 rounded-r-full bg-info/70" style={{ width: `${(60 / 390) * 100}%` }} />}
        {s.dayProgress > 0 && s.dayProgress < 1 && <div className="absolute -top-1 h-3.5 w-0.5 bg-text" style={{ left: `${s.dayProgress * 100}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span><span className="text-buy">Opening</span> 9:30–11:00 AM</span>
        <span>Midday 11:00 AM–3:00 PM (muted)</span>
        <span>{s.earlyClose ? "Early close 1:00 PM — no power hour" : <><span className="text-info">Power hour</span> 3:00–4:00 PM</>}</span>
        <span>Close {s.earlyClose ? "1:00" : "4:00"} PM ET</span>
      </div>
    </section>
  );
}
