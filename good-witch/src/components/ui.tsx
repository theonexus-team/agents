"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MEMBERS } from "@/lib/content";
import { useToast } from "./Providers";

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "gold" | "outline" | "ghost" | "light" | "outline-light";

const variants: Record<Variant, string> = {
  primary: "bg-plum-800 text-ivory-50 hover:bg-plum-700 shadow-[0_8px_20px_-10px_rgb(43_22_54/0.8)]",
  gold: "bg-gold-400 text-plum-950 hover:bg-gold-300 shadow-[0_8px_24px_-10px_rgb(184_150_90/0.9)]",
  outline: "border border-plum-800/25 text-plum-800 hover:border-plum-800/60 hover:bg-plum-800/5",
  ghost: "text-plum-700 hover:bg-plum-800/5",
  light: "bg-ivory-50 text-plum-900 hover:bg-white",
  "outline-light": "border border-ivory-50/35 text-ivory-50 hover:bg-ivory-50/10 hover:border-ivory-50/70",
};

export function btn(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md", extra = "") {
  const sizes = { sm: "h-9 px-4 text-[0.65rem]", md: "h-11 px-6 text-[0.7rem]", lg: "h-13 px-8 text-[0.72rem]" };
  return `inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase tracking-[0.2em] transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" {...props} className={btn(variant, size, className)} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={btn(variant, size, className)}>
      {children}
    </Link>
  );
}

/** Small round icon button (save / like / share) */
export function IconButton({
  label,
  active,
  onClick,
  children,
  tone = "light",
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const base =
    tone === "dark"
      ? active
        ? "bg-gold-400 text-plum-950 border-gold-400"
        : "border-ivory-50/25 text-ivory-50 hover:bg-ivory-50/10"
      : active
        ? "bg-plum-800 text-ivory-50 border-plum-800"
        : "border-plum-800/15 text-plum-800 hover:bg-plum-800/5";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-90 ${base}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Labels ---------------- */

export function DemoTag({ children = "Demo content", tone = "light" }: { children?: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.58rem] font-medium uppercase tracking-[0.18em] ${
        tone === "dark" ? "border-gold-300/40 bg-plum-950/40 text-gold-300 backdrop-blur" : "border-gold-500/35 bg-ivory-50 text-gold-600"
      }`}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-1.5 text-gold-600">{eyebrow}</p>}
        <h2 className="display text-[1.7rem] text-plum-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="animate-rise px-5 pt-6 pb-2 lg:px-0 lg:pt-10">
      {eyebrow && <p className="eyebrow mb-2 text-gold-600">{eyebrow}</p>}
      <h1 className="display text-[2.5rem] text-plum-900 sm:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-plum-700/80">{sub}</p>}
      {children}
    </header>
  );
}

export function Avatar({ memberId, hue, initial, size = 40 }: { memberId?: string; hue?: number; initial?: string; size?: number }) {
  const m = memberId ? MEMBERS.find((x) => x.id === memberId) : undefined;
  const h = hue ?? m?.hue ?? 285;
  const letter = initial ?? m?.name[0] ?? "W";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-serif text-ivory-50 ring-2 ring-ivory-50"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: `radial-gradient(circle at 30% 25%, hsl(${h} 35% 62%), hsl(${h} 38% 30%))`,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/* ---------------- Sheet (bottom sheet on mobile, dialog on desktop) ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-night/60 backdrop-blur-[3px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={`animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] outline-none sm:max-w-lg sm:rounded-[1.75rem] ${
          dark ? "bg-plum-950 text-ivory-50" : "bg-ivory-50 text-ink"
        } shadow-[var(--shadow-float)]`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-inherit px-6 pt-5 pb-3">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-current opacity-15 sm:hidden absolute left-1/2 top-2 -translate-x-1/2" />
          <div className="pt-2">
            {eyebrow && <p className={`eyebrow mb-1 ${dark ? "text-gold-300" : "text-gold-600"}`}>{eyebrow}</p>}
            {title && <h3 className={`display text-2xl ${dark ? "text-ivory-50" : "text-plum-900"}`}>{title}</h3>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dark ? "bg-ivory-50/10 hover:bg-ivory-50/20" : "bg-plum-800/5 hover:bg-plum-800/10"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Share ---------------- */

export function useShare() {
  const toast = useToast();
  return async (text: string, title = "A Good Witch") => {
    const payload = `${text}\n\n— shared from the A Good Witch concept app`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: payload });
        return;
      }
      await navigator.clipboard.writeText(payload);
      toast("Copied to your clipboard to share");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast("Ready to share: copy it from the card");
    }
  };
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gold-500/40 bg-ivory-50/60 px-6 py-10 text-center">
      <p className="display text-xl text-plum-900">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-plum-700/70">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-plum-700/80">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-plum-700/60">{hint}</span>}
    </label>
  );
}

export function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
