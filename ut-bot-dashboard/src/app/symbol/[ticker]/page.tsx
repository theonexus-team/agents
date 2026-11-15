import { notFound } from "next/navigation";
import { findSymbol } from "@/lib/symbols";
import { getBars } from "@/lib/marketData";
import Sparkline from "@/components/Sparkline";

export default async function SymbolPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const sym = findSymbol(decodeURIComponent(ticker));
  if (!sym) notFound();
  return (
    <section className="card px-4 py-4">
      <h1 className="text-lg font-semibold">{sym.ticker} <span className="text-sm font-normal text-muted">{sym.sector} · {sym.kind}{!sym.tradeable && " · context only, never paper-traded"}</span></h1>
      <p className="text-[11px] text-muted">Yahoo symbol {sym.yahooSymbol} · sample 2m series until market data is connected (Lightweight Charts with UT markers next)</p>
      <div className="mt-4"><Sparkline values={(await getBars(sym.ticker)).bars.slice(-120).map((b) => b.close)} up height={120} /></div>
    </section>
  );
}
