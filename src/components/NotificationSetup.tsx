"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer;
}

/** Drop this on any desk-key-gated page to offer enabling push notifications for
 * that device. iOS Safari only allows Web Push from a site added to the home
 * screen (Settings/manifest.ts handles the "capable" flag for that) — a regular
 * browser tab on iPhone can't subscribe at all, which this surfaces rather than
 * failing silently. */
export function NotificationSetup({ deskKey }: { deskKey: string }) {
  const [status, setStatus] = useState<"idle" | "unsupported" | "subscribing" | "subscribed" | "denied" | "error">(
    "idle"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) setStatus("subscribed");
    });
  }, []);

  const subscribe = async () => {
    setStatus("subscribing");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("error");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deskKey, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  };

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted">
        Push notifications aren&apos;t available in this browser. On iPhone, add this site to your home screen first
        (Share → Add to Home Screen), then open it from there.
      </p>
    );
  }
  if (status === "subscribed") {
    return <p className="text-xs text-accent">Notifications enabled on this device.</p>;
  }
  if (status === "denied") {
    return <p className="text-xs text-danger">Notification permission denied — check your browser/site settings.</p>;
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "subscribing"}
      className="rounded-md border border-panel-border bg-black/20 px-3 py-1.5 text-xs text-foreground hover:border-foreground/40 disabled:opacity-50"
    >
      {status === "subscribing" ? "Enabling…" : status === "error" ? "Failed — try again" : "Enable notifications on this device"}
    </button>
  );
}
