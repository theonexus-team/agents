import { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  className = "",
  tag,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Optional label chip next to the title, e.g. "tradeable set". */
  tag?: string;
}) {
  return (
    <section
      className={`card p-4 sm:p-5 ${className}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {title && (
        <header className="mb-3.5 flex flex-wrap items-baseline gap-2">
          <h4 className="m-0 text-[15px] font-medium text-foreground">{title}</h4>
          {tag && <span className="tag tag-neutral flex-none">{tag}</span>}
          {subtitle && <p className="m-0 basis-full text-xs text-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-black/20 px-3 py-2.5">
      <span className="text-[11px] tracking-wide text-muted uppercase">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      {sub && <span className="text-[11px] text-muted/80">{sub}</span>}
    </div>
  );
}
