"use client";
import type { NakshatraRow } from "@/lib/nakshatra";

export default function NakshatraPanel({ rows, autoId, selected, onSelect, placeholder }: {
  rows: NakshatraRow[]; autoId: number; selected: number; onSelect: (id: number) => void; placeholder: boolean;
}) {
  const r = rows[selected - 1];
  const tiles: [string, string][] = [
    ["Ruling planet", r.ruling_planet ?? "—"], ["Zodiac", r.zodiac ?? "—"], ["Element", r.element ?? "—"],
    ["Sentiment", r.sentiment ?? "—"], ["Tone", r.tone ?? "—"], ["Sector impact", r.sector_impact.join(", ") || "—"],
    ["Reference stocks", r.reference_stocks.join(", ") || "—"],
  ];
  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold tracking-wider text-wait">NAKSHATRA CONTEXT</span>
          <span className="text-[11px] text-muted">User-provided mapping • independent of UT signals{placeholder && " · placeholder table until the client's file arrives"}</span>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted">
          Nakshatra
          <select value={selected} onChange={(e) => onSelect(Number(e.target.value))} className="rounded-md border border-line bg-panel-2 px-2 py-1 text-xs text-text">
            {rows.map((n) => <option key={n.id} value={n.id}>{n.id}. {n.name}{n.id === autoId ? " (today, auto)" : ""}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tile k="Today's Moon" v={`${r.id}. ${r.name}`} accent={selected === autoId ? "auto" : "manual"} />
        {tiles.map(([k, v]) => <Tile key={k} k={k} v={v} />)}
      </div>
    </section>
  );
}

function Tile({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2">
      <div className="label">{k}{accent && <span className="ml-1 normal-case text-info">{accent}</span>}</div>
      <div className={`mt-1 text-sm ${k === "Tone" ? "text-news" : ""}`}>{v}</div>
    </div>
  );
}
