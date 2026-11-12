"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarHeart, Crown, Home, Info, Moon, ShoppingBag, Sparkles, Store, User, Users } from "lucide-react";
import { BRAND } from "@/lib/content";
import { useApp } from "@/lib/store";
import { Avatar, Sheet } from "./ui";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/daily", label: "Daily Magic", icon: Sparkles },
  { href: "/coven", label: "The Coven", icon: Users },
  { href: "/readings", label: "Readings", icon: Moon },
  { href: "/shop", label: "Shop", icon: Store },
];

const MORE = [
  { href: "/events", label: "Events", icon: CalendarHeart },
  { href: "/membership", label: "The Good Coven", icon: Crown },
  { href: "/profile", label: "My Profile", icon: User },
];

export function Wordmark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap leading-none ${className}`}>
      <span className={`text-[0.5rem] ${light ? "text-gold-300" : "text-gold-500"}`}>✦</span>
      <span className={`font-serif text-[1.08rem] font-medium tracking-[0.3em] ${light ? "text-ivory-50" : "text-plum-900"}`}>A GOOD WITCH</span>
      <span className={`text-[0.5rem] ${light ? "text-gold-300" : "text-gold-500"}`}>✦</span>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/") || (href === "/shop" && pathname === "/bag");
}

export function AboutConcept({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="About this prototype" title="A concept, not an official app">
      <div className="space-y-4 text-[0.95rem] leading-relaxed text-plum-800/90">
        <p>{BRAND.disclaimer}</p>
        <p>
          It shows how a creator with an established audience could bring daily content, community, readings, events and merchandise
          together in one branded experience.
        </p>
        <ul className="space-y-2 text-sm">
          <li>• Members, posts, events and creator messages are fictional demonstration content.</li>
          <li>• Product names, prices and the private reading offer reflect the publicly visible store; descriptions were written for this concept.</li>
          <li>• Membership features are a proposal. No subscription price exists here.</li>
          <li>• No payments, bookings, registrations or posts leave your device. Your saved items live in this browser only.</li>
          <li>• Daily reflections are for inspiration and are not medical or mental health advice.</li>
        </ul>
      </div>
    </Sheet>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const app = useApp();
  const [about, setAbout] = useState(false);
  const bagCount = app.cart.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="min-h-dvh bg-ivory-100 lg:flex">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-gold-500/15 bg-plum-950 text-ivory-50 lg:flex">
        <Link href="/home" className="px-8 pt-10 pb-8" aria-label="A Good Witch home">
          <Wordmark light />
        </Link>
        <div className="ornament mx-8 mb-6 text-[0.5rem]">◆</div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4" aria-label="Primary">
          {TABS.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm tracking-wide transition-colors ${
                  active ? "bg-ivory-50/10 text-ivory-50" : "text-lavender-200/70 hover:bg-ivory-50/5 hover:text-ivory-50"
                }`}
              >
                <t.icon className={`h-[18px] w-[18px] ${active ? "text-gold-300" : ""}`} strokeWidth={1.5} />
                {t.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-300" />}
              </Link>
            );
          })}
          <p className="eyebrow mt-6 mb-2 px-4 text-lavender-300/50">More</p>
          {MORE.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  active ? "bg-ivory-50/10 text-ivory-50" : "text-lavender-200/70 hover:bg-ivory-50/5 hover:text-ivory-50"
                }`}
              >
                <t.icon className={`h-[17px] w-[17px] ${active ? "text-gold-300" : ""}`} strokeWidth={1.5} />
                {t.label}
              </Link>
            );
          })}
          <Link
            href="/bag"
            className={`flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm transition-colors ${
              pathname === "/bag" ? "bg-ivory-50/10 text-ivory-50" : "text-lavender-200/70 hover:bg-ivory-50/5 hover:text-ivory-50"
            }`}
          >
            <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={1.5} />
            Shopping Bag
            {bagCount > 0 && <span className="ml-auto rounded-full bg-gold-400 px-2 py-0.5 text-[0.65rem] font-semibold text-plum-950">{bagCount}</span>}
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => setAbout(true)}
          className="m-4 flex items-start gap-2.5 rounded-xl border border-gold-300/20 p-4 text-left text-[0.7rem] leading-relaxed text-lavender-200/60 transition-colors hover:border-gold-300/40"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" />
          Independent concept prototype. Not affiliated with or endorsed by A Good Witch.
        </button>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 border-b border-gold-500/10 bg-ivory-100/85 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/profile" aria-label="My profile" className="rounded-full">
              <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={32} />
            </Link>
            <Link href="/home" aria-label="A Good Witch home">
              <Wordmark />
            </Link>
            <Link href="/bag" aria-label={`Shopping bag, ${bagCount} items`} className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-plum-800 hover:bg-plum-800/5">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {bagCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[0.58rem] font-semibold text-white">
                  {bagCount}
                </span>
              )}
            </Link>
          </div>
          <button type="button" onClick={() => setAbout(true)} className="block w-full bg-plum-900 py-1 text-center text-[0.58rem] uppercase tracking-[0.2em] text-lavender-200/80">
            Concept prototype · not an official app · tap to learn more
          </button>
        </header>

        {/* Desktop top bar */}
        <div className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-gold-500/10 bg-ivory-100/85 px-10 py-3 backdrop-blur-md lg:flex">
          <Link href="/events" className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] text-plum-700 hover:bg-plum-800/5">
            Events
          </Link>
          <Link href="/membership" className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] text-plum-700 hover:bg-plum-800/5">
            Membership
          </Link>
          <Link href="/bag" aria-label="Shopping bag" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-plum-800 hover:bg-plum-800/5">
            <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            {bagCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[0.58rem] font-semibold text-white">{bagCount}</span>
            )}
          </Link>
          <Link href="/profile" aria-label="My profile" className="ml-1 flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 hover:bg-plum-800/5">
            <Avatar hue={app.avatarHue} initial={(app.firstName || "W")[0].toUpperCase()} size={32} />
            <span className="text-sm text-plum-800">{app.firstName || "Witch"}</span>
          </Link>
        </div>

        <main className="mx-auto w-full max-w-5xl pb-32 lg:px-10 lg:pb-16">{children}</main>
      </div>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-gold-500/20 bg-plum-950/95 backdrop-blur-lg lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[0.6rem] tracking-[0.08em] transition-colors ${
                    active ? "text-gold-300" : "text-lavender-200/60"
                  }`}
                >
                  {active && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-gold-300" />}
                  <t.icon className="h-[21px] w-[21px]" strokeWidth={active ? 1.8 : 1.4} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AboutConcept open={about} onClose={() => setAbout(false)} />
    </div>
  );
}
