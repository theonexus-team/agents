import type { TradeRow } from "@/lib/types";

export function EquityCurve({ startingBalance, trades }: { startingBalance: number; trades: TradeRow[] }) {
  const chronological = [...trades].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
  if (chronological.length === 0) {
    return <p className="text-xs text-muted">No closed trades to chart yet.</p>;
  }

  const points = chronological.reduce<number[]>(
    (acc, t) => [...acc, acc[acc.length - 1] + t.net],
    [startingBalance]
  );

  const width = 600;
  const height = 160;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1 || 1);
  const yFor = (p: number) => height - ((p - min) / range) * height;

  const coords = points.map((p, i) => `${(i * stepX).toFixed(1)},${yFor(p).toFixed(1)}`);
  const positive = points[points.length - 1] >= startingBalance;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
      <line
        x1="0"
        x2={width}
        y1={yFor(startingBalance)}
        y2={yFor(startingBalance)}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeDasharray="4 4"
      />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={positive ? "var(--color-accent)" : "var(--color-danger)"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
