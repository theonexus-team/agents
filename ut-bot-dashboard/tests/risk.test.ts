import { describe, it, expect } from "vitest";
import { riskLevels } from "@/lib/risk";

describe("options risk plan", () => {
  it("$0.80 premium → 3 contracts, one per target", () => {
    const r = riskLevels(0.8);
    expect(r.contracts).toBe(3);
    expect(r.costUsd).toBe(240);
    expect(r.stopPrice).toBe(0.64);
    expect(r.maxLossUsd).toBe(48);
    expect(r.targets.map((t) => [t.price, t.contracts])).toEqual([[1.12, 1], [1.4, 1], [1.6, 1]]);
    expect(r.maxProfitUsd).toBe(32 + 60 + 80);
  });

  it("premium above $2.50 buys zero contracts at $250", () => {
    expect(riskLevels(3).contracts).toBe(0);
  });

  it("1 contract: everything rides to the last target", () => {
    expect(riskLevels(2.0).targets.map((t) => t.contracts)).toEqual([0, 0, 1]);
  });
});
