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

  const width = 900;
  const height = 220;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = range * 0.1;
  const stepX = width / (points.length - 1 || 1);
  const yFor = (p: number) => height - ((p - (min - pad)) / (range + pad * 2)) * height;

  const linePath = points.map((p, i) => `${i ? "L" : "M"}${(i * stepX).toFixed(1)} ${yFor(p).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;
  const positive = points[points.length - 1] >= startingBalance;

  return (
    <div className="relative h-56 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible">
        <defs>
          <linearGradient id="eqSmall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9184d9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#9184d9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={width} y1={yFor(startingBalance)} y2={yFor(startingBalance)} stroke="#595d6c" strokeWidth="1" strokeDasharray="2 6" />
        <path d={areaPath} fill="url(#eqSmall)" />
        <path
          d={linePath}
          fill="none"
          stroke={positive ? "#7fd6a8" : "#f08a9b"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
