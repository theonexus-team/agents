"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_TABS = [
  { href: "/", label: "My Dashboard" },
  { href: "/live", label: "Live Strategy" },
  { href: "/backtests", label: "Backtests" },
];

export function SiteHeader({
  showNav = true,
  status,
}: {
  /** Client-account dashboards get the wordmark + status pill only, no internal nav. */
  showNav?: boolean;
  status?: { label: string; tone: "accent" | "warn" | "neutral" };
}) {
  const pathname = usePathname();
  const tone = status?.tone ?? "accent";

  return (
    <header
      className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--background) 86%, transparent)",
        backdropFilter: "blur(14px)",
        boxShadow: "0 1px 0 var(--panel-border)",
      }}
    >
      <div className="mr-auto flex items-baseline gap-2.5">
        <span className="font-heading text-[17px] font-semibold tracking-[0.18em] uppercase text-foreground">
          Theonexus
        </span>
        <span className="text-[11px] tracking-[0.14em] uppercase text-brand-2">Trading Oracle</span>
      </div>

      {showNav && (
        <nav className="flex min-w-0 gap-1">
          {NAV_TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className="nx-tab" data-active={active}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}

      {status && (
        <div
          className="flex flex-none items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5"
          style={
            tone === "accent"
              ? { borderColor: "#2f6f52", background: "rgba(47,111,82,0.16)" }
              : tone === "warn"
                ? { borderColor: "#7a5a24", background: "rgba(230,181,103,0.14)" }
                : { borderColor: "var(--panel-border)", background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }
          }
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{
              background: tone === "accent" ? "#7fd6a8" : tone === "warn" ? "#e6b567" : "var(--muted)",
              animation: "pulseDot 2.4s ease-in-out infinite",
            }}
          />
          <span
            className="text-xs tracking-wide uppercase"
            style={{ color: tone === "accent" ? "#9fe3bf" : tone === "warn" ? "#f5cf94" : "var(--muted)" }}
          >
            {status.label}
          </span>
        </div>
      )}
    </header>
  );
}
