import { getConnections, type ConnStatus } from "@/lib/connections";

export const dynamic = "force-dynamic";

const BADGE: Record<ConnStatus, [string, string]> = {
  connected: ["Keys set", "bg-buy/15 text-buy"],
  missing: ["Not connected", "bg-wait/15 text-wait"],
  no_account_needed: ["No account needed", "bg-info/15 text-info"],
  later: ["Later", "bg-panel-2 text-muted"],
};

export default function SetupPage() {
  const conns = getConnections();
  const done = conns.filter((c) => c.status !== "missing").length;
  return (
    <div className="space-y-4">
      <section className="card px-5 py-4">
        <h1 className="text-lg font-semibold">Accounts &amp; connections</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to each account below and collect the values listed. Nothing is connected to these services yet — the app runs on sample data until each
          key is added to <code className="num">.env.local</code> (local) or Vercel → Environment Variables (production). This page only checks whether a value
          is present; it never calls the service.
        </p>
        <div className="mt-3 text-sm"><span className="num">{done}</span> / {conns.length} ready</div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {conns.map((c) => {
          const [label, cls] = BADGE[c.status];
          return (
            <section key={c.id} className="card flex flex-col px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{c.name} {!c.required && <span className="text-xs font-normal text-muted">(optional)</span>}</h2>
                  <p className="text-[13px] text-muted">{c.purpose}</p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {c.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {c.envVars.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.envVars.map((v) => (
                    <span key={v.name} className={`num rounded px-2 py-0.5 text-[11px] ${v.set ? "bg-buy/10 text-buy" : "bg-panel-2 text-muted"}`}>
                      {v.set ? "✓" : "○"} {v.name}
                    </span>
                  ))}
                </div>
              )}
              {c.signupUrl && (
                <a href={c.signupUrl} target="_blank" rel="noreferrer" className="mt-auto pt-4 text-sm text-info">Sign in to {c.name.split(" (")[0]} ↗</a>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
