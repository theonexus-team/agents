export default function Sparkline({ values, up, height = 40 }: { values: number[]; up: boolean; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), w = 300;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / (max - min || 1)) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={pts} fill="none" stroke={up ? "var(--color-buy)" : "var(--color-sell)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
