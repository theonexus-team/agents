import { fmtUsd } from "@/lib/format";
import type { TradeRow } from "@/lib/types";

/**
 * Per-strategy record, grouped from the real trade log — not the design mock's
 * illustrative "5 registered" placeholder roster. Only strategies that have
 * actually closed a trade show up here, so this list grows/shrinks with reality
 * instead of needing to be hand-maintained.
 */
export function TradingAlgorithms({ trades }: { trades: TradeRow[] }) {
  const byStrategy = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const list = byStrategy.get(t.strategy) ?? [];
    list.push(t);
    byStrategy.set(t.strategy, list);
  }

  const algos = Array.from(byStrategy.entries()).map(([name, rows]) => {
    const wins = rows.filter((r) => r.net > 0).length;
    const net = rows.reduce((s, r) => s + r.net, 0);
    const avgR = rows.reduce((s, r) => s + r.perDollarRisked, 0) / rows.length;
    const worstTrade = Math.min(...rows.map((r) => r.net));
    const symbols = Array.from(new Set(rows.map((r) => r.symbol)));
    return {
      name,
      scope: symbols.join(" · "),
      trades: rows.length,
      winRate: rows.length ? wins / rows.length : 0,
      net,
      avgR,
      worstTrade,
    };
  });

  if (algos.length === 0) return null;

  return (
    <section className="card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h4 className="m-0 text-[15px] font-medium text-foreground">Trading algorithms</h4>
        <span className="mr-auto text-xs text-muted">Per-strategy record, grouped from the real trade log</span>
        <span className="tag tag-outline flex-none">{algos.length} active</span>
      </div>
      <div className="mt-4 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
        {algos.map((a) => (
          <div key={a.name} className="flex flex-col gap-3 rounded-xl bg-black/20 p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{a.name}</div>
                <div className="mt-0.5 text-xs text-muted">{a.scope}</div>
              </div>
              <span className="tag tag-accent flex-none">live</span>
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
                <span>Win rate</span>
                <span className="text-sm font-medium text-foreground/90">{Math.round(a.winRate * 100)}%</span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg,#5d5294,#b5abfc)", width: `${Math.round(a.winRate * 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat label="Net profit" value={fmtUsd(a.net, true)} color={a.net >= 0 ? "var(--accent)" : "var(--danger)"} />
              <MiniStat label="Trades" value={String(a.trades)} />
              <MiniStat label="Avg R" value={a.avgR.toFixed(2)} />
              <MiniStat label="Worst trade" value={fmtUsd(a.worstTrade, true)} color="var(--danger)" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-0.5 text-[17px] font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
