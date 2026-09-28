"use client";

import { useState } from "react";

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-6 text-center">
      <h1 className="m-0 text-[22px] font-medium text-foreground">Join the mastermind</h1>
      <p className="m-0 text-sm text-muted">
        Membership includes the live dashboard, tools, and training library. $197/month, cancel anytime.
      </p>
      <button onClick={subscribe} disabled={loading} className="btn btn-primary">
        {loading ? "Redirecting…" : "Subscribe with Stripe"}
      </button>
      {error && <p className="m-0 text-xs text-red-400">{error}</p>}
    </main>
  );
}
