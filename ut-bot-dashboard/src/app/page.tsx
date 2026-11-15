import Dashboard from "@/components/Dashboard";
import SessionTimer from "@/components/SessionTimer";
import { SYMBOLS } from "@/lib/symbols";
import { NAKSHATRAS, NAKSHATRA_TABLE_IS_PLACEHOLDER, moonNakshatra } from "@/lib/nakshatra";
import { sampleSignals, sampleQuotes, sampleBars, sampleClock, SAMPLE_ECON, SAMPLE_PAPER } from "@/lib/sample";
import { listSignals, lastWebhookAt } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const real = listSignals();
  const sampleMode = real.length === 0;
  const refNow = sampleMode ? sampleClock().getTime() : Date.now();
  const signals = sampleMode ? sampleSignals(refNow) : real;
  const bars = Object.fromEntries(["QQQ", "SMH"].map((t) => [t, sampleBars(t).map((b) => b.close)]));
  return (
    <div className="space-y-4">
      <SessionTimer lastWebhook={lastWebhookAt()} />
      <Dashboard
        signals={signals}
        symbols={SYMBOLS}
        quotes={sampleQuotes()}
        bars={bars}
        nakshatras={NAKSHATRAS}
        autoNakId={moonNakshatra(new Date()).nakId}
        nakPlaceholder={NAKSHATRA_TABLE_IS_PLACEHOLDER}
        refNow={refNow}
        sampleMode={sampleMode}
        econ={SAMPLE_ECON}
        paper={SAMPLE_PAPER}
      />
    </div>
  );
}
