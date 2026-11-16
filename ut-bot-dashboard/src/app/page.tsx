import Dashboard from "@/components/Dashboard";
import SessionTimer from "@/components/SessionTimer";
import { SYMBOLS } from "@/lib/symbols";
import { NAKSHATRAS, NAKSHATRA_TABLE_IS_PLACEHOLDER, moonNakshatra } from "@/lib/nakshatra";
import { SAMPLE_ECON } from "@/lib/sample";
import { getQuotes, getBars } from "@/lib/marketData";
import { todaysEvents } from "@/lib/econCalendar";
import { paperSummary } from "@/lib/paper";
import { listSignals, lastWebhookAt, syncState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  await syncState();
  const real = listSignals();
  // Live: real signals only (no sample rows). Until the first alert, every symbol sits under "No signal yet" with its live price.
  const sampleMode = false;
  const refNow = Date.now();
  const signals = real;
  const [{ quotes }, econ, ...barSets] = await Promise.all([getQuotes(), todaysEvents(), ...["QQQ", "SMH"].map((t) => getBars(t))]);
  const bars = Object.fromEntries(["QQQ", "SMH"].map((t, i) => [t, barSets[i].bars.slice(-60).map((b) => b.close)]));
  const marks = Object.fromEntries(quotes.map((q) => [q.ticker, q.price]));
  const ps = paperSummary(marks);
  // Same shape the dashboard card already uses.
  const paper = { start: ps.start, value: ps.value, realized: ps.realized, open: ps.open, winRate: ps.winRate, closed: ps.closed, wins: ps.wins, avgWin: ps.avgWin, avgLoss: ps.avgLoss,
    positions: ps.positions.map((p) => ({ ticker: p.ticker, qty: p.qty, entry: p.entry_price, window: p.window === "pre_market" ? "Pre-market" : p.window === "midday" ? "Midday" : p.window === "power_hour" ? "Power hour" : "Opening", pnl: p.pnl })),
    byTone: ps.byTone.map((t) => ({ tone: t.key, pnl: t.pnl, trades: t.trades, win: t.win })) };
  return (
    <div className="space-y-4">
      <SessionTimer lastWebhook={lastWebhookAt()} />
      <Dashboard
        signals={signals}
        symbols={SYMBOLS}
        quotes={quotes}
        bars={bars}
        nakshatras={NAKSHATRAS}
        autoNakId={moonNakshatra(new Date()).nakId}
        nakPlaceholder={NAKSHATRA_TABLE_IS_PLACEHOLDER}
        refNow={refNow}
        sampleMode={sampleMode}
        econ={econ.source === "none" ? SAMPLE_ECON : econ.rows}
        paper={paper}
      />
    </div>
  );
}
