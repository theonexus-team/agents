import { describe, it, expect } from "vitest";
import { getSessionState, windowAt, windowEnds, isTradingDay } from "@/lib/session";

const et = (s: string) => new Date(s); // ISO with explicit offset

describe("session", () => {
  it("summer (EDT, -04:00) phases", () => {
    expect(getSessionState(et("2026-07-15T06:30:00-04:00")).phase).toBe("pre");
    expect(getSessionState(et("2026-07-15T09:00:00-04:00")).phase).toBe("premarket");
    expect(getSessionState(et("2026-07-15T09:30:00-04:00")).phase).toBe("opening");
    expect(getSessionState(et("2026-07-15T12:00:00-04:00")).phase).toBe("midday");
    expect(getSessionState(et("2026-07-15T15:38:00-04:00")).label).toBe("POWER HOUR — 22m left");
    expect(getSessionState(et("2026-07-15T16:00:00-04:00")).phase).toBe("closed");
  });

  it("winter (EST, -05:00) phases use the same ET clock", () => {
    const s = getSessionState(et("2026-11-16T10:02:00-05:00"));
    expect(s.phase).toBe("opening");
    expect(s.label).toBe("OPENING SESSION — 58m left");
    expect(getSessionState(et("2026-11-16T08:18:00-05:00")).label).toBe("PRE-MARKET — NY opens in 1h 12m");
    expect(getSessionState(et("2026-11-16T08:18:00-05:00")).window).toBe("pre_market");
    expect(getSessionState(et("2026-11-16T06:50:00-05:00")).label).toBe("Pre-market monitoring starts 7:00 AM ET (in 10m)");
    expect(getSessionState(et("2026-11-16T12:56:00-05:00")).label).toBe("Midday — power hour in 2h 4m");
  });

  it("DST change days", () => {
    // 2026-03-09 is the Monday after spring-forward; 2026-11-02 the Monday after fall-back.
    expect(windowAt(et("2026-03-09T09:32:00-04:00"))).toBe("opening");
    expect(windowAt(et("2026-11-02T09:32:00-05:00"))).toBe("opening");
    expect(windowAt(et("2026-11-02T09:32:00-04:00"))).toBe("pre_market"); // 08:32 ET
    expect(windowAt(et("2026-11-02T07:32:00-04:00"))).toBe("outside"); // 06:32 ET
  });

  it("weekends and holidays are closed", () => {
    expect(isTradingDay(et("2026-11-14T10:00:00-05:00"))).toBe(false); // Saturday
    expect(isTradingDay(et("2026-11-26T10:00:00-05:00"))).toBe(false); // Thanksgiving
    const s = getSessionState(et("2026-11-14T10:00:00-05:00"));
    expect(s.phase).toBe("closed");
    expect(s.label).toBe("Market closed — monitoring resumes Mon 7:00 AM ET");
  });

  it("early close: no power hour, window ends at 1:00 PM", () => {
    const d = et("2026-11-27T12:00:00-05:00");
    expect(getSessionState(d).label).toMatch(/^Early close — no power hour/);
    expect(windowAt(et("2026-11-27T15:30:00-05:00"))).toBe("outside");
    expect(windowEnds(d).map((x) => x.toISOString())).toEqual(["2026-11-27T14:30:00.000Z", "2026-11-27T16:00:00.000Z", "2026-11-27T18:00:00.000Z"]);
  });

  it("windows include the boundary bar close", () => {
    expect(windowAt(et("2026-11-16T11:00:00-05:00"))).toBe("opening");
    expect(windowAt(et("2026-11-16T11:02:00-05:00"))).toBe("midday");
    expect(windowAt(et("2026-11-16T16:00:00-05:00"))).toBe("power_hour");
  });

  it("matches the Pine script's open-time sessions", () => {
    expect(windowAt(et("2026-11-16T07:00:00-05:00"))).toBe("outside"); // bar opened 6:58, before monitoring
    expect(windowAt(et("2026-11-16T07:02:00-05:00"))).toBe("pre_market"); // first pre-market bar, opened 7:00
    expect(windowAt(et("2026-11-16T09:30:00-05:00"))).toBe("pre_market"); // bar opened 9:28, last pre-market bar
    expect(windowAt(et("2026-11-16T09:32:00-05:00"))).toBe("opening"); // first bar, opened 9:30
    expect(windowAt(et("2026-11-16T15:00:00-05:00"))).toBe("midday"); // opened 14:58
    expect(windowAt(et("2026-11-16T15:02:00-05:00"))).toBe("power_hour"); // opened 15:00
  });
});
