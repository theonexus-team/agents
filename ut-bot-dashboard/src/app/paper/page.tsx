import { SAMPLE_PAPER as P } from "@/lib/sample";

const signed = (n: number) => `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`.replace("+$-", "-$");

export default function PaperPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Paper trades <span className="ml-2 rounded bg-wait/15 px-2 py-0.5 text-[11px] text-wait">sample</span></h1>
        <p className="text-[11px] text-muted">Options · $250 premium per trade · stop −20% · targets +40% / +75% / +100% · figures below are share-based sample data · auto-close at window end · times in ET</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat k="Account value" v={`$${P.value.toFixed(2)}`} sub={`from $${P.start.toFixed(2)}`} />
        <Stat k="Net P&L · all" v={signed(P.realized)} sub="closed trades" good />
        <Stat k="Win rate" v={`${P.winRate}%`} sub={`${P.wins} of ${P.closed} trades`} />
        <Stat k="Avg win / loss" v={`${signed(P.avgWin)} / ${signed(P.avgLoss)}`} sub="" />
      </div>
      <section className="card px-4 py-3">
        <h2 className="font-semibold">Nakshatra insights · by Tone</h2>
        <p className="text-[11px] text-muted">Tagging only, no trades filtered yet. Trade count shown next to every bucket.</p>
        {P.byTone.map((t) => (
          <div key={t.tone} className="mt-3">
            <div className="flex justify-between text-sm"><span>{t.tone}</span><span className="num text-buy">{signed(t.pnl)}</span></div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
              <span className="w-8">{t.win}%</span>
              <div className="h-1.5 flex-1 rounded-full bg-panel-2"><div className="h-full rounded-full bg-buy" style={{ width: `${t.win}%` }} /></div>
              <span>{t.trades} trades</span>
            </div>
          </div>
        ))}
      </section>
      <section className="card px-4 py-3">
        <h2 className="font-semibold">Open positions · {P.positions.length}</h2>
        {P.positions.map((p) => (
          <div key={p.ticker} className="flex justify-between border-t border-line py-2 text-sm first:border-0">
            <span><b>{p.ticker}</b> <span className="text-muted">Long {p.qty} sh @ ${p.entry.toFixed(2)} · {p.window}</span></span>
            <span className="num text-buy">{signed(p.pnl)}</span>
          </div>
        ))}
      </section>
      <p className="text-[11px] text-muted">Reset, equity curve, closed-trade list and CSV export are wired once Supabase is connected.</p>
    </div>
  );
}

function Stat({ k, v, sub, good }: { k: string; v: string; sub: string; good?: boolean }) {
  return <div className="card px-4 py-3"><div className="label">{k}</div><div className={`num mt-1 text-xl font-semibold ${good ? "text-buy" : ""}`}>{v}</div><div className="text-[11px] text-muted">{sub}</div></div>;
}
