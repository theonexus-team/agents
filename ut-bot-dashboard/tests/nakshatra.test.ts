import { describe, it, expect } from "vitest";
import { lahiriAyanamsa, nakshatraFromSiderealLon, moonNakshatra, NAKSHATRAS } from "@/lib/nakshatra";

describe("nakshatra math", () => {
  it("Lahiri ayanamsa ≈ 24.2° in 2026", () => {
    const a = lahiriAyanamsa(new Date("2026-06-01T00:00:00Z"));
    expect(a).toBeGreaterThan(24.15);
    expect(a).toBeLessThan(24.25);
  });

  it("maps longitude to nakshatra / pada / sign", () => {
    expect(nakshatraFromSiderealLon(0)).toMatchObject({ nakId: 1, pada: 1, moonSign: "Aries" });
    expect(nakshatraFromSiderealLon(47.3)).toMatchObject({ nakId: 4, pada: 3, moonSign: "Taurus" }); // spec says pada 2, but Rohini spans 40°–53°20′ so 47.3° is pada 3
    expect(nakshatraFromSiderealLon(359.9)).toMatchObject({ nakId: 27, pada: 4, moonSign: "Pisces" });
  });

  it("table has 27 rows in order", () => {
    expect(NAKSHATRAS).toHaveLength(27);
    expect(NAKSHATRAS[3].name).toBe("Rohini");
  });

  it("moon moves ~13°/day (one nakshatra per day)", () => {
    const a = moonNakshatra(new Date("2026-11-16T15:00:00Z")).moonSiderealLon;
    const b = moonNakshatra(new Date("2026-11-17T15:00:00Z")).moonSiderealLon;
    const d = (b - a + 360) % 360;
    expect(d).toBeGreaterThan(11);
    expect(d).toBeLessThan(16);
  });

  // TODO: add 5–10 dates checked against a published panchang (e.g. drikpanchang.com, New York location).
});
