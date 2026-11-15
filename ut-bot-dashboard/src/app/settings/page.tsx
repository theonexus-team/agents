import { headers } from "next/headers";
import { SYMBOLS } from "@/lib/symbols";
import { lastWebhookAt } from "@/lib/store";
import { DEFAULT_RISK, riskLevels } from "@/lib/risk";

const ex = riskLevels(0.8);

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/webhook/tradingview`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="TradingView">
        <Row k="Webhook URL" v={url} mono />
        <Row k="Secret" v={process.env.WEBHOOK_SECRET ? "set (WEBHOOK_SECRET)" : "not set"} />
        <Row k="Last webhook" v={lastWebhookAt() ?? "none yet"} />
        <p className="mt-2 text-[11px] text-muted">TradingView only posts to ports 80/443 — use the Vercel URL in alerts, not localhost.</p>
      </Card>
      <Card title="Options risk plan (client, Nov 15)">
        <Row k="Per trade" v={`$${DEFAULT_RISK.tradeSizeUsd} of premium`} />
        <Row k="Stop loss" v={`-${DEFAULT_RISK.stopPct}% of premium`} />
        {DEFAULT_RISK.targets.map((t, i) => <Row key={i} k={`Target ${i + 1}`} v={`+${t.pct}% · exit 1/3 (to confirm)`} />)}
        <Row k="Example: $0.80 premium" v={`${ex.contracts} contracts · stop $${ex.stopPrice} (−$${ex.maxLossUsd}) · targets ${ex.targets.map((t) => "$" + t.price.toFixed(2)).join(" / ")}`} />
        <Row k="Auto-close" v="11:00 AM and 4:00 PM ET" />
        <p className="mt-2 text-[11px] text-muted">Still to confirm: split across targets, strike / expiry, SELL = buy puts?, stop move after target 1.</p>
      </Card>
      <Card title="Trading windows (read-only, must match indicator)">
        <Row k="Opening session" v="9:30–11:00 AM ET" /><Row k="Power hour" v="3:00–4:00 PM ET" /><Row k="Chart labels" v="NY session 9:30 AM–4:00 PM ET" />
      </Card>
      <Card title="News filter">
        <Row k="Source" v={process.env.ECON_PROVIDER || "forexfactory"} /><Row k="Blocks" v="High impact, 10 min before → 10 min after" />
        <Row k="What is blocked" v="New BUYs only. Exits always go through." /><Row k="Shadow trades" v="On" />
      </Card>
      <Card title="Phone alerts">
        <Row k="Provider" v={process.env.PUSH_PROVIDER || "ntfy"} /><Row k="Target" v={process.env.PUSH_TARGET ? "set" : "not set"} />
        <Row k="Pushes" v="Signals inside a window only" />
      </Card>
      <Card title={`Watchlist (${SYMBOLS.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {SYMBOLS.map((s) => <span key={s.ticker} className={`num rounded px-2 py-0.5 text-[11px] ${s.placeholder ? "border border-dashed border-line text-muted" : "bg-panel-2"}`}>{s.ticker}{s.kind === "context" && " (ctx)"}</span>)}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card px-4 py-3"><h2 className="mb-2 text-sm font-semibold">{title}</h2>{children}</section>;
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="flex justify-between gap-3 border-t border-line py-1.5 text-sm first-of-type:border-0"><span className="text-muted">{k}</span><span className={`text-right break-all ${mono ? "num text-xs" : ""}`}>{v}</span></div>;
}
