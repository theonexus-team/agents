import { describe, it, expect, beforeEach } from "vitest";
import { applySignal, closeAllAtWindowEnd, paperSummary, resetPaper } from "../src/lib/paper";
import type { Signal } from "../src/lib/types";

const sig = (ticker: string, side: "BUY" | "SELL", price: number, over: Partial<Signal> = {}): Signal => ({
  id: crypto.randomUUID(), ticker, side, setup: side === "BUY" ? "UT1" : "UT2", price, tf: "2",
  bar_time: Date.now() - 120_000, bar_close_time: Date.now(), window: "opening", received_at: new Date().toISOString(), status: "accepted",
  ut_key: 1, ut_atr_len: 10, ut_heikin: false, ut_stop: null, atr: null, news_state: "clear", nearest_event: null, minutes_to_event: null,
  ...({ nak_name: "Rohini", tone: "Calm" } as object), ...over,
} as Signal);

describe("paper engine (signal to signal, stop-and-reverse)", () => {
  beforeEach(() => resetPaper(1000));

  it("first BUY opens a long sized at 25% of the account, fractional shares", () => {
    expect(applySignal(sig("AAPL", "BUY", 200)).action).toBe("opened");
    const s = paperSummary();
    expect(s.positions[0]).toMatchObject({ side: "long", qty: 1.25 }); // $250 / $200
    expect(s.cash).toBe(750);
  });

  it("first SELL opens a short", () => {
    expect(applySignal(sig("TSLA", "SELL", 250)).action).toBe("opened");
    expect(paperSummary().positions[0]).toMatchObject({ side: "short", qty: 1 });
  });

  it("each signal closes the trade and opens the opposite one", () => {
    applySignal(sig("AAPL", "BUY", 200));                      // long 1.25 @ 200
    expect(applySignal(sig("AAPL", "SELL", 220)).action).toBe("reversed"); // close +$25, short @ 220
    let s = paperSummary();
    expect(s.trades[0]).toMatchObject({ side: "long", pnl_usd: 25, exit_reason: "opposite_signal" });
    expect(s.positions[0]).toMatchObject({ side: "short", entry_price: 220 });
    expect(applySignal(sig("AAPL", "BUY", 210)).action).toBe("reversed"); // short gains $10/sh
    s = paperSummary();
    expect(s.trades[0].side).toBe("short");
    expect(s.trades[0].pnl_usd).toBeGreaterThan(0);
    expect(s.positions[0].side).toBe("long");
  });

  it("a repeat signal in the same direction is ignored", () => {
    applySignal(sig("AAPL", "BUY", 200));
    expect(applySignal(sig("AAPL", "BUY", 205)).reason).toBe("already_long");
  });

  it("news blackout / outside the window: the exit happens, no new entry", () => {
    applySignal(sig("META", "BUY", 500));
    expect(applySignal(sig("META", "SELL", 490, { status: "blocked_news" })).action).toBe("closed");
    expect(paperSummary().positions).toHaveLength(0);
    expect(applySignal(sig("SPY", "BUY", 500, { status: "outside_window" })).action).toBe("ignored");
  });

  it("3:00 PM close settles longs and shorts at the last price", async () => {
    applySignal(sig("AAPL", "BUY", 200));
    applySignal(sig("SPY", "SELL", 500));
    const closed = await closeAllAtWindowEnd(async (t) => (t === "AAPL" ? 198 : 490));
    expect(closed.map((t) => t.exit_reason)).toEqual(["window_end", "window_end"]);
    expect(closed.find((t) => t.ticker === "SPY")!.pnl_usd).toBe(5); // short 0.5 sh, +$10
    expect(paperSummary().positions).toHaveLength(0);
  });
});
