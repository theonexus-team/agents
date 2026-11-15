"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Dashboard"], ["/signals", "Signal log"], ["/paper", "Paper trades"], ["/settings", "Settings"], ["/setup", "Accounts"],
] as const;

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
