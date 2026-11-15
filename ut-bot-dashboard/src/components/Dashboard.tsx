"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import type { Signal } from "@/lib/types";
import type { WatchSymbol } from "@/lib/symbols";
import type { NakshatraRow } from "@/lib/nakshatra";
import type { Quote } from "@/lib/sample";
import { rowStatus, ageLabel, latestByTicker, type RowStatus } from "@/lib/status";
import NakshatraPanel from "./NakshatraPanel";
import Sparkline from "./Sparkline";

interface Props {
  signals: Signal[];
  symbols: WatchSymbol[];
  quotes: Quote[];
  bars: Record<string, number[]>;
  nakshatras: NakshatraRow[];
  autoNakId: number;
  nakPlaceholder: boolean;
  refNow: number;
  sampleMode: boolean;
  econ: { time: string; impact: string; title: string; detail: string; state: string }[];
  paper: { value: number; start: number; realized: number; open: number; closed: number; winRate: number };
}

const et = (ms: number) => formatInTimeZone(new Date(ms), "America/New_York", "h:mm a");
const usd = (n: number) => `$${n.toFixed(2)}`;
const signed = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;

export default function Dashboard(p: Props) {
  const [nakId, setNakId] = useState(p.autoNakId);
  const latest = useMemo(() => latestByTicker(p.signals), [p.signals]);
  const quote = (t: string) => p.quotes.find((q) => q.ticker === t);
  const [selected, setSelected] = useState<string | null>(() => [...latest.values()].find((s) => s.ticker === "AAPL")?.ticker ?? [...latest.keys()][0] ?? null);
  const refStocks = p.nakshatras[nakId - 1].reference_stocks;

  const etfs = p.symbols.filter((s) => s.kind !== "stock");
  const stocks = p.symbols.filter((s) => s.kind === "stock");
  const sel = selected ? latest.get(selected) : undefined;

  const move = (s: Signal) => {
    const q = quote(s.ticker);
    if (!q) return null;
    const d = q.price - s.price;
    return { d, pct: (d / s.price) * 100, withSignal: s.side === "BUY" ? d >= 0 : d <= 0, last: q.price };
  };

  return (
    <div className="space-y-4">
      {p.sampleMode && (
        <div className="text-[11px] text-muted">Showing sample signals as of {formatInTimeZone(new Date(p.refNow), "America/New_York", "EEE MMM d, h:mm:ss a")} ET · prices are sample until Yahoo is wired</div>
      )}

      {/* Economic calendar */}
      <section className="card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">US economic calendar · today</div>
            <div className="text-[11px] text-muted">News filter: no new BUYs from 10 min before to 10 min after a High-impact event · exits always allowed</div>
          </div>
          <span className="rounded bg-buy/15 px-2 py-0.5 text-[11px] text-buy">Clear · no more High events today</span>
        </div>
        <div className="mt-2 divide-y divide-line">
          {p.econ.map((e) => (
            <div key={e.title} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="num w-20 text-xs text-muted">{e.time}</span>
              <span className={`w-16 rounded px-1.5 py-0.5 text-center text-[10px] ${e.impact === "High" ? "bg-sell/15 text-sell" : "bg-wait/15 text-wait"}`}>{e.impact}</span>
              <span className="flex-1">{e.title}</span>
              <span className="num hidden text-[11px] text-muted sm:inline">{e.detail}</span>
              <span className="w-16 text-right text-[11px] text-muted">{e.state}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-muted">Sample events · live source: Forex Factory feed now, FXStreet API once licensed · times ET</div>
      </section>

      <NakshatraPanel rows={p.nakshatras} autoId={p.autoNakId} selected={nakId} onSelect={setNakId} placeholder={p.nakPlaceholder} />

      {/* Primary focus + context */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {["QQQ", "SMH"].map((t) => {
          const q = quote(t), s = latest.get(t);
          return (
            <button key={t} onClick={() => setSelected(t)} className="card px-4 py-3 text-left hover:border-info/40">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t} <span className="label ml-1">primary</span></div>
                {s && <SideBadge side={s.side} extra={ageLabel(s, p.refNow)} />}
              </div>
              {q && (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="num text-2xl font-semibold">{usd(q.price)}</span>
                  <span className={`num text-xs ${q.change >= 0 ? "text-buy" : "text-sell"}`}>{signed(q.change)} / {signed(q.changePct)}%</span>
                </div>
              )}
              <Sparkline values={p.bars[t] ?? []} up={(q?.change ?? 0) >= 0} />
              {s && <div className="text-[11px] text-muted">Signal {usd(s.price)} at {et(s.bar_close_time)} · move since signal</div>}
            </button>
          );
        })}
        <div className="grid gap-4">
          {["VIX", "CL1!"].map((t) => {
            const q = quote(t), qqq = quote("QQQ");
            const diverging = q && qqq && Math.sign(q.change) !== Math.sign(qqq.change);
            return (
              <div key={t} className="card px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{t} <span className="label ml-1">context</span></div>
                  {q && <span className="num text-sm">{usd(q.price)} <span className={q.change >= 0 ? "text-buy" : "text-sell"}>{signed(q.changePct)}%</span></span>}
                </div>
                <div className={`mt-2 rounded px-2 py-1 text-[11px] ${diverging ? "bg-news/15 text-news" : "bg-wait/10 text-wait"}`}>
                  {diverging ? "Diverging from QQQ / SMH" : "Moving with QQQ · watch for divergence"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SignalTable title="ETFs & market context" rows={etfs} latest={latest} refNow={p.refNow} move={move} selected={selected} onSelect={setSelected} />
      <SignalTable title={`Stocks · watchlist (${stocks.length})`} rows={stocks} latest={latest} refNow={p.refNow} move={move} selected={selected} onSelect={setSelected} refStocks={refStocks} />

      {/* Bottom row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card px-4 py-3">
          <div className="label">Selected signal{sel ? ` · ${sel.ticker}` : ""}</div>
          {sel ? (() => {
            const m = move(sel);
            return (
              <>
                <div className={`mt-1 text-lg font-semibold ${sel.side === "BUY" ? "text-buy" : "text-sell"}`}>{sel.side} · {et(sel.bar_close_time)} ET · Signal {usd(sel.price)}</div>
                {m && <div className="text-sm">Price moved {m.withSignal ? "WITH" : "AGAINST"} the signal: <span className={`num ${m.withSignal ? "text-buy" : "text-sell"}`}>{signed(m.d)} / {signed(m.pct)}%</span></div>}
                <div className="mt-1 text-[11px] text-muted">Window: {sel.window.replace("_", " ")} · setup {sel.setup} · key {sel.ut_key ?? "—"} / ATR {sel.ut_atr_len ?? "—"}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-panel-2 p-3 text-sm">
                  <KV k="Nakshatra" v={`${sel.nak_name}${sel.nak_pada ? ` · pada ${sel.nak_pada}` : ""}`} />
                  <KV k="Sentiment" v={sel.sentiment ?? "—"} />
                  <KV k="Tone" v={sel.tone ?? "—"} />
                  <KV k="Element" v={sel.element ?? "—"} />
                  <KV k="Planet" v={sel.ruling_planet ?? "—"} />
                  <KV k="Reference" v={sel.reference_match ? "Yes" : "No"} />
                </div>
                <Link href={`/symbol/${encodeURIComponent(sel.ticker)}`} className="mt-2 inline-block text-xs text-info">Symbol detail →</Link>
              </>
            );
          })() : <div className="mt-2 text-sm text-muted">Click any row.</div>}
        </div>
        <div className="card px-4 py-3">
          <div className="label">Phone alert preview</div>
          {sel ? (
            <div className="mt-2 flex gap-3 rounded-lg bg-panel-2 p-3">
              <span>🔔</span>
              <div className="text-sm leading-snug">
                <div className="font-semibold">{sel.ticker} | UT {sel.side}{sel.status === "blocked_news" ? ` | BLOCKED — ${sel.nearest_event}` : ""} | 2m</div>
                <div>{et(sel.bar_close_time)} ET | Confirmed close {usd(sel.price)}</div>
                <div className="text-muted">{sel.window === "opening" ? "Opening session" : sel.window === "power_hour" ? "Power hour" : "Outside window — no push"} | Paper trading</div>
              </div>
            </div>
          ) : null}
          <div className="mt-2 text-[11px] text-muted">Sent by TradingView app + dashboard push. Pause the alert in TradingView to stop both.</div>
        </div>
        <div className="card px-4 py-3">
          <div className="label">Paper account</div>
          <div className="num mt-1 text-2xl font-semibold">{usd(p.paper.value)}</div>
          <div className="text-sm">Realized <span className="text-buy">{signed(p.paper.realized)}</span> · Open <span className="text-buy">{signed(p.paper.open)}</span></div>
          <div className="mt-1 text-[11px] text-muted">Started at {usd(p.paper.start)} · 25% per trade · {p.paper.closed} closed · {p.paper.winRate}% win rate {p.sampleMode && "(sample)"}</div>
          <Link href="/paper" className="mt-3 inline-block rounded-md bg-info/15 px-3 py-1.5 text-xs text-info">Open paper trades</Link>
        </div>
      </section>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div><div className="label">{k}</div><div>{v}</div></div>;
}

function SideBadge({ side, extra }: { side: "BUY" | "SELL"; extra?: string }) {
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${side === "BUY" ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell"}`}>{side}{extra ? ` · ${extra}` : ""}</span>;
}

const STATUS_STYLE: Record<RowStatus, [string, string]> = {
  FRESH: ["FRESH · Review setup", "bg-buy/15 text-buy"],
  WAIT: ["WAIT · No new trigger", "bg-wait/15 text-wait"],
  BLOCKED: ["BLOCKED · News", "bg-news/15 text-news"],
  OUT: ["OUT OF WINDOW", "bg-panel-2 text-muted"],
};

function SignalTable({ title, rows, latest, refNow, move, selected, onSelect, refStocks }: {
  title: string; rows: WatchSymbol[]; latest: Map<string, Signal>; refNow: number;
  move: (s: Signal) => { d: number; pct: number; withSignal: boolean } | null;
  selected: string | null; onSelect: (t: string) => void; refStocks?: string[];
}) {
  const withSig = rows.map((r) => ({ r, s: latest.get(r.ticker) })).filter((x) => x.s) as { r: WatchSymbol; s: Signal }[];
  withSig.sort((a, b) => b.s.bar_close_time - a.s.bar_close_time);
  const fresh = withSig.filter((x) => rowStatus(x.s, refNow) === "FRESH");
  const rest = withSig.filter((x) => rowStatus(x.s, refNow) !== "FRESH");
  const none = rows.filter((r) => !latest.has(r.ticker));

  const Row = ({ r, s }: { r: WatchSymbol; s: Signal }) => {
    const st = rowStatus(s, refNow);
    const m = move(s);
    const [label, cls] = STATUS_STYLE[st];
    return (
      <tr onClick={() => onSelect(r.ticker)} className={`cursor-pointer border-t border-line hover:bg-panel-2 ${selected === r.ticker ? "bg-panel-2" : ""} ${st === "OUT" ? "opacity-50" : ""}`}>
        <td className="py-2 pl-4 font-semibold">{r.ticker}</td>
        <td><SideBadge side={s.side} /></td>
        <td className="num text-xs text-muted">{et(s.bar_close_time)} · {ageLabel(s, refNow)}</td>
        <td className="num">{usd(s.price)}</td>
        <td className={`num text-xs ${m ? (m.withSignal ? "text-buy" : "text-sell") : "text-muted"}`}>{m ? `${signed(m.d)} / ${signed(m.pct)}%` : "—"}</td>
        <td><span className={`rounded px-2 py-0.5 text-[11px] ${cls}`}>{st === "BLOCKED" && s.nearest_event ? `BLOCKED · News (${s.nearest_event})` : label}</span></td>
        {refStocks && <td className="pr-4 text-right text-xs">{refStocks.includes(r.ticker) ? <span className="rounded bg-wait/15 px-2 py-0.5 text-wait">★ Reference match</span> : <span className="text-muted">—</span>}</td>}
      </tr>
    );
  };

  return (
    <section className="card overflow-x-auto">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex gap-1 text-[10px]">
          {refStocks ? <span className="text-muted">★ = in the selected Nakshatra&apos;s reference list</span> : <>
            <span className="rounded bg-buy/15 px-2 py-0.5 text-buy">BUY = Bullish</span>
            <span className="rounded bg-sell/15 px-2 py-0.5 text-sell">SELL = Bearish</span>
            <span className="rounded bg-wait/15 px-2 py-0.5 text-wait">WAIT = No new trigger</span></>}
        </div>
      </div>
      <table className="mt-2 w-full min-w-[720px] text-left text-sm">
        <thead className="label">
          <tr><th className="py-2 pl-4 font-normal">Symbol</th><th className="font-normal">Latest UT</th><th className="font-normal">Time / age</th><th className="font-normal">Signal price</th><th className="font-normal">Move since signal</th><th className="font-normal">Entry status</th>{refStocks && <th className="pr-4 text-right font-normal">Reference</th>}</tr>
        </thead>
        <tbody>
          {fresh.length > 0 && <tr><td colSpan={7} className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wider text-buy">FRESH BUY / SELL</td></tr>}
          {fresh.map((x) => <Row key={x.r.ticker} {...x} />)}
          {rest.length > 0 && <tr><td colSpan={7} className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wider text-wait">WAIT · PREVIOUS SIGNALS, NEWEST FIRST</td></tr>}
          {rest.map((x) => <Row key={x.r.ticker} {...x} />)}
        </tbody>
      </table>
      {none.length > 0 && (
        <div className="px-4 pb-3">
          <div className="pt-3 pb-2 text-xs font-semibold tracking-wider text-muted">NO SIGNAL YET</div>
          <div className="flex flex-wrap gap-2">
            {none.map((r) => <span key={r.ticker} className="rounded-md border border-dashed border-line px-3 py-1.5 text-[11px] text-muted">{r.placeholder ? `[${r.ticker}] · add to watchlist` : r.ticker}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
