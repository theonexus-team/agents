import { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-panel-border bg-panel/60 p-4 sm:p-5 ${className}`}
    >
      {title && (
        <header className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted/80">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-panel-border/60 bg-black/20 px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="font-mono text-lg font-medium text-foreground">{value}</span>
      {sub && <span className="text-[11px] text-muted/80">{sub}</span>}
    </div>
  );
}
