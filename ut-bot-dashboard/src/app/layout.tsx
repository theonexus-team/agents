import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Clock from "@/components/Clock";
import Nav from "@/components/Nav";
import { getConnections } from "@/lib/connections";

export const metadata: Metadata = { title: "UT Bot · ETFs & Stocks", description: "UT Bot signal dashboard — paper trading" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const missing = getConnections().filter((c) => c.required && c.status === "missing");
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
          <header className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-info/15 text-info">↗</div>
              <div>
                <div className="font-semibold">UT BOT <span className="text-muted font-normal">| ETFs &amp; Stocks</span></div>
                <div className="text-[11px] text-muted">2-minute confirmed signals · New York session · Eastern time (ET)</div>
              </div>
            </Link>
            <Nav />
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-wait/15 px-3 py-1 text-[11px] font-semibold text-wait">PAPER MODE</span>
              <Clock />
            </div>
          </header>
          {missing.length > 0 && (
            <Link href="/setup" className="block rounded-lg border border-wait/30 bg-wait/10 px-4 py-2 text-sm text-wait">
              Setup mode · sample data · {missing.length} account{missing.length > 1 ? "s" : ""} still to connect: {missing.map((m) => m.name).join(", ")} →
            </Link>
          )}
          {children}
          <footer className="pb-6 text-[11px] text-muted">
            Paper trading — not trading advice. Nakshatra panel uses the client&apos;s own mapping and never affects UT signals.
          </footer>
        </div>
      </body>
    </html>
  );
}
