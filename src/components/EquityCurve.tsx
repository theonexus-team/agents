"use client";

import { useRef, useState } from "react";
import { fmtUsd } from "@/lib/format";
import type { TradeRow } from "@/lib/types";

function fmtPointDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EquityCurve({ startingBalance, trades }: { startingBalance: number; trades: TradeRow[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const chronological = [...trades].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
  if (chronological.length === 0) {
    return <p className="text-xs text-muted">No closed trades to chart yet.</p>;
  }

  const points = chronological.reduce<{ closedAt: string; v: number }[]>(
    (acc, t) => [...acc, { closedAt: t.closedAt, v: acc[acc.length - 1].v + t.net }],
    [{ closedAt: chronological[0].openedAt, v: startingBalance }]
  );

  const width = 900;
  const height = 220;
  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = range * 0.1;
  const stepX = width / (points.length - 1 || 1);
  const yFor = (p: number) => height - ((p - (min - pad)) / (range + pad * 2)) * height;
  const xFor = (i: number) => i * stepX;

  const linePath = points.map((p, i) => `${i ? "L" : "M"}${xFor(i).toFixed(1)} ${yFor(p.v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;
  const positive = points[points.length - 1].v >= startingBalance;

  function updateHover(clientX: number) {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const idx = Math.round(frac * (points.length - 1));
    setHoverIdx(Math.min(Math.max(idx, 0), points.length - 1));
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const hoveredChange = hovered ? hovered.v - startingBalance : 0;
  const hoveredXPct = hoverIdx !== null ? (xFor(hoverIdx) / width) * 100 : 0;

  return (
    <div
      ref={chartRef}
      className="relative h-56 w-full touch-none select-none"
      onPointerMove={(e) => updateHover(e.clientX)}
      onPointerDown={(e) => updateHover(e.clientX)}
      onPointerLeave={() => setHoverIdx(null)}
    >
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
        {hovered && hoverIdx !== null && (
          <>
            <line
              x1={xFor(hoverIdx)}
              y1="0"
              x2={xFor(hoverIdx)}
              y2={height}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.7"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={xFor(hoverIdx)} cy={yFor(hovered.v)} r="4.5" fill="#b5abfc" stroke="var(--panel)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 flex flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{
            background: "var(--panel)",
            boxShadow: "var(--shadow-md)",
            left: `${Math.min(Math.max(hoveredXPct, 12), 88)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="text-muted">{fmtPointDate(hovered.closedAt)}</span>
          <span className="font-semibold text-foreground">{fmtUsd(hovered.v)}</span>
          <span className={hoveredChange >= 0 ? "text-accent" : "text-danger"}>{fmtUsd(hoveredChange, true)} since start</span>
        </div>
      )}
    </div>
  );
}
