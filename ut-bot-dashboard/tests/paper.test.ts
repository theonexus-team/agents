import { describe, it, expect, beforeEach } from "vitest";
import { applySignal, closeAllAtWindowEnd, paperSummary, resetPaper } from "../src/lib/paper";
import type { Signal } from "../src/lib/types";

const sig = (ticker: string, side: "BUY" | "SELL", price: number, over: Partial<Signal> = {}): Signal => ({
  id: crypto.randomUUID(), ticker, side, setup: side === "BUY" ? "UT1" : "UT2", price, tf: "2",
  bar_time: Date.now() - 120_000, bar_close_time: Date.now(), window: "opening", received_at: new Date().toISOString(), status: "accepted",
  ut_key: 1, ut_atr_len: 10, ut_heikin: false, ut_stop: null, atr: null, news_state: "clear", nearest_event: null, minutes_to_event: null,
  ...({ nak_name: "Rohini", tone: "Calm" } as object), ...over,
} as Signal);

describe("paper engine (long-only)", () => {
  beforeEach(() => resetPaper(1000));

  it("BUY flat opens a long sized at 25% of the account, fractional shares", () => {
    expect(applySignal(sig("AAPL", "BUY", 200)).action).toBe("opened");
    const s = paperSummary();
    expect(s.positions).toHaveLength(1);
    expect(s.positions[0].qty).toBe(1.25); // $250 / $200
    expect(s.cash).toBe(750);
  });

  it("BUY while already long is ignored; SELL flat is ignored", () => {
    applySignal(sig("AAPL", "BUY", 200));
    expect(applySignal(sig("AAPL", "BUY", 210)).reason).toBe("already_long");
    expect(applySignal(sig("TSLA", "SELL", 300)).reason).toBe("flat");
  });

  it("SELL closes the long at the signal price and books P&L", () => {
    applySignal(sig("AAPL", "BUY", 200));
    expect(applySignal(sig("AAPL", "SELL", 220)).action).toBe("closed");
    const s = paperSummary();
    expect(s.positions).toHaveLength(0);
    expect(s.trades[0].pnl_usd).toBe(25); // 1.25 sh × $20
    expect(s.trades[0].exit_reason).toBe("opposite_signal");
    expect(s.value).toBe(1025);
    expect(s.winRate).toBe(100);
  });

  it("news-blocked or outside-window BUYs never open; SELL exits still go through", () => {
    expect(applySignal(sig("AAPL", "BUY", 200, { status: "blocked_news" })).action).toBe("ignored");
    expect(applySignal(sig("AAPL", "BUY", 200, { status: "outside_window" })).action).toBe("ignored");
    applySignal(sig("META", "BUY", 500));
    expect(applySignal(sig("META", "SELL", 490, { status: "blocked_news" })).action).toBe("closed");
  });

  it("window end closes everything at the last price", async () => {
    applySignal(sig("AAPL", "BUY", 200));
    applySignal(sig("SPY", "BUY", 500));
    const closed = await closeAllAtWindowEnd(async (t) => (t === "AAPL" ? 198 : 505));
    expect(closed.map((t) => t.exit_reason)).toEqual(["window_end", "window_end"]);
    expect(paperSummary().positions).toHaveLength(0);
  });

  it("sizes from current equity: 4 positions use ~the whole account, a 5th gets what's left", () => {
    for (const [t, p] of [["AAPL", 100], ["SPY", 100], ["QQQ", 100], ["MU", 100]] as const) applySignal(sig(t, "BUY", p));
    expect(paperSummary().cash).toBeCloseTo(0, 1);
    expect(applySignal(sig("TSLA", "BUY", 100)).reason).toBe("no_cash");
  });
});
