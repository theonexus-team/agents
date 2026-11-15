import { listSignals } from "@/lib/store";
import { sampleSignals, sampleClock } from "@/lib/sample";
import { fmtEt } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  const real = listSignals();
  const rows = real.length ? real : sampleSignals(sampleClock().getTime());
  return (
    <section className="card overflow-x-auto">
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <h1 className="font-semibold">Signal log</h1>
          <p className="text-[11px] text-muted">{real.length ? "Webhooks received since the server started (in-memory until Supabase is connected)" : "Sample rows — no webhooks received yet"} · filters + CSV export come with Supabase</p>
        </div>
      </div>
      <table className="mt-2 w-full min-w-[900px] text-left text-sm">
        <thead className="label"><tr>{["Bar close (ET)", "Symbol", "Side", "Setup", "Price", "Window", "Status", "Nakshatra", "Tone", "News"].map((h) => <th key={h} className="py-2 pl-4 font-normal">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-line">
              <td className="num py-2 pl-4 text-xs">{fmtEt(new Date(s.bar_close_time), "MMM d h:mm a")}</td>
              <td className="pl-4 font-semibold">{s.ticker}</td>
              <td className={`pl-4 ${s.side === "BUY" ? "text-buy" : "text-sell"}`}>{s.side}</td>
              <td className="pl-4 text-muted">{s.setup}</td>
              <td className="num pl-4">${s.price.toFixed(2)}</td>
              <td className="pl-4 text-xs">{s.window}</td>
              <td className="pl-4 text-xs">{s.status}</td>
              <td className="pl-4 text-xs">{s.nak_name}</td>
              <td className="pl-4 text-xs text-news">{s.tone ?? "—"}</td>
              <td className="pl-4 text-xs">{s.news_state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
