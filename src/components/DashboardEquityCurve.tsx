"use client";

import { useMemo, useRef, useState } from "react";
import { fmtUsd } from "@/lib/format";
import type { TradeRow } from "@/lib/types";

function fmtPointDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const RANGES: { label: string; days: number }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "All", days: Infinity },
];

const WIDTH = 900;
const HEIGHT = 240;

/**
 * Real equity curve reconstructed from the actual trade log — cumulative net
 * on top of the account's starting balance, sliced by the selected calendar
 * window. Not a chart library: a hand-built SVG path, matching the redesign.
 */
export function DashboardEquityCurve({
  startingBalance,
  currentBalance,
  peakEquity,
  trades,
}: {
  startingBalance: number;
  currentBalance: number;
  peakEquity: number;
  trades: TradeRow[];
}) {
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fullSeries = useMemo(() => {
    const chronological = [...trades].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
    const firstT = chronological.length > 0 ? new Date(chronological[0].openedAt).getTime() : Date.now();
    const points = [{ t: firstT, v: startingBalance }];
    for (const trade of chronological) {
      points.push({ t: new Date(trade.closedAt).getTime(), v: points[points.length - 1].v + trade.net });
    }
    return points;
  }, [trades, startingBalance]);

  const series = useMemo(() => {
    if (!Number.isFinite(rangeDays)) return fullSeries;
    const cutoff = Date.now() - rangeDays * 86_400_000;
    const idx = fullSeries.findIndex((p) => p.t >= cutoff);
    const sliced = fullSeries.slice(Math.max(idx, 0));
    return sliced.length >= 2 ? sliced : [{ t: cutoff, v: fullSeries[fullSeries.length - 1].v }, fullSeries[fullSeries.length - 1]];
  }, [fullSeries, rangeDays]);

  const lo = Math.min(...series.map((p) => p.v));
  const hi = Math.max(...series.map((p) => p.v));
  const pad = (hi - lo) * 0.12 || 100;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const y = (v: number) => HEIGHT - ((v - yMin) / (yMax - yMin)) * HEIGHT;
  const x = (i: number) => (i * WIDTH) / (series.length - 1 || 1);

  const linePath = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;

  const periodChange = series[series.length - 1].v - series[0].v;
  const peakY = y(peakEquity);
  const peakVisible = peakY >= -4 && peakY <= HEIGHT + 4;
  const startY = y(series[0].v);

  const axis = [0, 1, 2, 3, 4].map((i) => fmtUsd(yMax - ((yMax - yMin) * i) / 4));

  function updateHover(clientX: number) {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const idx = Math.round(frac * (series.length - 1));
    setHoverIdx(Math.min(Math.max(idx, 0), series.length - 1));
  }

  const hovered = hoverIdx !== null ? series[hoverIdx] : null;
  const hoveredChange = hovered ? hovered.v - series[0].v : 0;
  const hoveredXPct = hoverIdx !== null ? (x(hoverIdx) / WIDTH) * 100 : 0;

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 mb-1 text-[15px] font-medium text-foreground">Equity curve</h4>
          <p className="m-0 text-xs text-muted">Account balance, marked to close · paper</p>
        </div>
        <div className="flex flex-none items-baseline gap-4">
          <div>
            <div className="text-[11px] tracking-wide text-muted uppercase">Balance</div>
            <div className="text-xl font-semibold text-foreground">{fmtUsd(currentBalance)}</div>
          </div>
          <div>
            <div className="text-[11px] tracking-wide text-muted uppercase">Period</div>
            <div className={`text-xl font-semibold ${periodChange >= 0 ? "text-accent" : "text-danger"}`}>
              {fmtUsd(periodChange, true)}
            </div>
          </div>
        </div>
        <div className="flex flex-none gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className="nx-tab text-xs"
              data-active={rangeDays === r.days}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div
          ref={chartRef}
          className="relative h-[250px] min-w-0 flex-1 touch-none select-none"
          onPointerMove={(e) => updateHover(e.clientX)}
          onPointerDown={(e) => updateHover(e.clientX)}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible">
            <defs>
              <linearGradient id="eqDashboard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9184d9" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#9184d9" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[10, 67, 124, 181, 238].map((gy) => (
              <line key={gy} x1="0" y1={gy} x2={WIDTH} y2={gy} stroke={gy === 238 ? "#3f424d" : "#2b2d3a"} strokeWidth="1" />
            ))}
            <path d={areaPath} fill="url(#eqDashboard)" />
            <path d={linePath} fill="none" stroke="#b5abfc" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {peakVisible && (
              <line x1="0" y1={peakY} x2={WIDTH} y2={peakY} stroke="#7fd6a8" strokeWidth="1" strokeDasharray="4 5" opacity="0.7" />
            )}
            <line x1="0" y1={startY} x2={WIDTH} y2={startY} stroke="#595d6c" strokeWidth="1" strokeDasharray="2 6" />
            {hovered && hoverIdx !== null && (
              <>
                <line
                  x1={x(hoverIdx)}
                  y1="0"
                  x2={x(hoverIdx)}
                  y2={HEIGHT}
                  stroke="var(--muted)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity="0.7"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={x(hoverIdx)} cy={y(hovered.v)} r="4.5" fill="#b5abfc" stroke="var(--panel)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
          {peakVisible && (
            <div
              className="absolute left-0 bg-panel px-1.5 text-[10px] tracking-wide uppercase"
              style={{ color: "#7fd6a8", top: `${Math.min(Math.max((peakY / HEIGHT) * 100, 0), 96)}%` }}
            >
              peak {fmtUsd(peakEquity)}
            </div>
          )}
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
              <span className="text-muted">{fmtPointDate(hovered.t)}</span>
              <span className="font-semibold text-foreground">{fmtUsd(hovered.v)}</span>
              <span className={hoveredChange >= 0 ? "text-accent" : "text-danger"}>
                {fmtUsd(hoveredChange, true)} since start
              </span>
            </div>
          )}
        </div>
        <div className="flex w-[70px] flex-none flex-col justify-between pb-1 text-[11px] text-muted">
          {axis.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex justify-between pr-[82px] text-[11px] text-muted">
        <span>{Number.isFinite(rangeDays) ? `${rangeDays} days ago` : "since inception"}</span>
        <span>today</span>
      </div>
    </div>
  );
}
