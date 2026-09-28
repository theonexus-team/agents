"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { SiteHeader } from "@/components/SiteHeader";

type SetupData = {
  name: string;
  dashboardUrl: string;
  webhookSecret: string;
  webhookUrl: string;
  installRequestedAt: string | null;
  installPaidAt: string | null;
};

const PINE_SCRIPTS = [
  { key: "orb-breakout", label: "1m ORB + VWAP", file: "theonexus-orb-breakout.pine" },
  { key: "ob-reversal", label: "OB Reversal", file: "theonexus-ob-reversal.pine" },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] tracking-wide text-muted uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-black/20 px-3 py-2 text-xs text-foreground">
          {value}
        </code>
        <button
          className="btn btn-secondary flex-none"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function AccountSetup({ token }: { token: string }) {
  const [data, setData] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/setup?account=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch {
      setError("Couldn't load setup info.");
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function payForInstall() {
    setPayLoading(true);
    try {
      const res = await fetch("/api/stripe/install-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not start checkout");
      window.location.href = json.url;
    } catch {
      setPayLoading(false);
    }
  }

  return (
    <>
      <SiteHeader showNav={false} />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <div className="mb-2 text-[11px] tracking-[0.14em] text-brand uppercase">Setup</div>
          <h1 className="m-0 mb-1.5 text-[26px] font-medium text-foreground">
            {data ? `Connect ${data.name}'s TradingView` : "Connect your TradingView"}
          </h1>
          <p className="m-0 text-[13px] text-muted">
            Install both Pine scripts below on the same chart, then point their webhook alert at your dashboard.
          </p>
        </div>

        {error && <p className="m-0 text-sm text-red-400">{error}</p>}

        {data && (
          <>
            <Panel title="Your webhook">
              <div className="flex flex-col gap-4">
                <CopyField label="TradingView webhook URL" value={data.webhookUrl} />
                <CopyField label="Webhook secret" value={data.webhookSecret} />
                <p className="m-0 text-xs text-muted/80">
                  Keep this secret private — it&apos;s pasted directly into the Pine scripts below and controls
                  which dashboard your trades land on.
                </p>
                <CopyField label="Your dashboard" value={data.dashboardUrl} />
              </div>
            </Panel>

            <Panel title="Pine scripts to install" subtitle="Add both to the same chart.">
              <div className="flex flex-col gap-3">
                {PINE_SCRIPTS.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3 rounded-md bg-black/20 px-3 py-2.5">
                    <div>
                      <div className="text-sm text-foreground">{s.label}</div>
                      <div className="text-[11px] text-muted/80">{s.file}</div>
                    </div>
                    <a href={`/api/pine/${s.key}`} className="btn btn-secondary flex-none">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Prefer we set it up?">
              {data.installPaidAt ? (
                <p className="m-0 text-sm text-foreground">
                  Request received — we&apos;ll be in touch to finish your install.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-sm text-muted">
                    We&apos;ll install and configure both scripts on your chart for you.
                  </p>
                  <button onClick={payForInstall} disabled={payLoading} className="btn btn-primary flex-none">
                    {payLoading ? "Redirecting…" : "$100 — do it for me"}
                  </button>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>
    </>
  );
}
