import { syncState } from "@/lib/store";
import { paperSummary } from "@/lib/paper";
import { getQuotes } from "@/lib/marketData";
import { fmtEt } from "@/lib/session";
import ResetButton from "./ResetButton";

export const dynamic = "force-dynamic";
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
const winLabel = (w: string) => (w === "power_hour" ? "Power hour" : w === "opening" ? "Opening" : w === "pre_market" ? "Pre-market" : w === "midday" ? "Midday" : w);

export default async function PaperPage() {
  await syncState();
  const { quotes } = await getQuotes();
  const P = paperSummary(Object.fromEntries(quotes.map((q) => [q.ticker, q.price])));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Paper trades</h1>
          <p className="text-[11px] text-muted">Signal to signal: each BUY/SELL closes the open trade and opens the opposite one · trading 7:00 AM–3:00 PM ET (pre-market, opening, midday) · everything closes at 3:00 PM · {P.settings.size_value}% of account per trade, fractional shares · fills at the signal price · kept in memory until the database is connected</p>
        </div>
        <ResetButton start={P.start} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat k="Account value" v={`$${P.value.toFixed(2)}`} sub={`from $${P.start.toFixed(2)} · cash $${P.cash.toFixed(2)}`} />
        <Stat k="Net P&L · closed" v={signed(P.realized)} sub={`open ${signed(P.open)}`} good={P.realized >= 0} />
        <Stat k="Win rate" v={`${P.winRate}%`} sub={`${P.wins} of ${P.closed} trades`} />
        <Stat k="Avg win / loss" v={`${signed(P.avgWin)} / ${signed(P.avgLoss)}`} sub="" />
      </div>

      <section className="card px-4 py-3">
        <h2 className="font-semibold">Open positions · {P.positions.length}</h2>
        {!P.positions.length && <p className="mt-2 text-sm text-muted">Flat. The next signal between 7:00 AM and 3:00 PM opens a position.</p>}
        {P.positions.map((p) => (
          <div key={p.id} className="flex justify-between border-t border-line py-2 text-sm first:border-0">
            <span><b>{p.ticker}</b> <span className="text-muted">{p.side === "long" ? "Long" : "Short"} {p.qty} sh @ ${p.entry_price.toFixed(2)} · now ${p.mark.toFixed(2)} · {winLabel(p.window)}</span></span>
            <span className={`num ${p.pnl >= 0 ? "text-buy" : "text-sell"}`}>{signed(p.pnl)}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {([["By window", P.byWindow.map((x) => ({ ...x, key: winLabel(x.key) }))], ["By symbol", P.bySymbol], ["By Nakshatra tone", P.byTone]] as const).map(([title, rows]) => (
          <section key={title} className="card px-4 py-3">
            <h2 className="font-semibold">{title}</h2>
            {!rows.length && <p className="mt-2 text-[11px] text-muted">No closed trades yet.</p>}
            {rows.map((t) => (
              <div key={t.key} className="mt-3">
                <div className="flex justify-between text-sm"><span>{t.key}</span><span className={`num ${t.pnl >= 0 ? "text-buy" : "text-sell"}`}>{signed(t.pnl)}</span></div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                  <span className="w-8">{t.win}%</span>
                  <div className="h-1.5 flex-1 rounded-full bg-panel-2"><div className="h-full rounded-full bg-buy" style={{ width: `${t.win}%` }} /></div>
                  <span>{t.trades} trades</span>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="px-4 pt-3 font-semibold">Closed trades · {P.trades.length}</h2>
        <table className="mt-2 w-full min-w-[760px] text-left text-sm">
          <thead className="label"><tr>{["Closed (ET)", "Symbol", "Side", "Qty", "Entry", "Exit", "P&L", "%", "Reason", "Window", "Nakshatra"].map((h) => <th key={h} className="py-2 pl-4 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {P.trades.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="num py-2 pl-4 text-xs">{fmtEt(new Date(t.closed_at), "MMM d h:mm a")}</td>
                <td className="pl-4 font-semibold">{t.ticker}</td>
                <td className={`pl-4 text-xs ${t.side === "long" ? "text-buy" : "text-sell"}`}>{t.side}</td>
                <td className="num pl-4">{t.qty}</td>
                <td className="num pl-4">${t.entry_price.toFixed(2)}</td>
                <td className="num pl-4">${t.exit_price.toFixed(2)}</td>
                <td className={`num pl-4 ${t.pnl_usd >= 0 ? "text-buy" : "text-sell"}`}>{signed(t.pnl_usd)}</td>
                <td className="num pl-4">{t.pnl_pct.toFixed(2)}%</td>
                <td className="pl-4 text-xs">{t.exit_reason.replace("_", " ")}</td>
                <td className="pl-4 text-xs">{winLabel(t.window)}</td>
                <td className="pl-4 text-xs">{t.nak_name ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!P.trades.length && <p className="px-4 pb-3 text-[11px] text-muted">No closed trades yet.</p>}
      </section>
      <p className="text-[11px] text-muted">Options risk plan ($250 premium, stop −20%, targets +40/+75/+100%) is in lib/risk.ts; these paper figures are share-based until strikes and expiries are confirmed.</p>
    </div>
  );
}

function Stat({ k, v, sub, good }: { k: string; v: string; sub: string; good?: boolean }) {
  return <div className="card px-4 py-3"><div className="label">{k}</div><div className={`num mt-1 text-xl font-semibold ${good ? "text-buy" : ""}`}>{v}</div><div className="text-[11px] text-muted">{sub}</div></div>;
}
