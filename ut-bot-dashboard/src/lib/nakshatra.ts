/**
 * Moon Nakshatra at an instant (Lahiri ayanamsa), plus the client's mapping table.
 * Display/tagging only — never changes or blocks a signal.
 */
import * as Astronomy from "astronomy-engine";
import table from "@ref/nakshatras.json";

export interface NakshatraRow {
  id: number;
  name: string;
  ruling_planet: string | null;
  zodiac: string | null;
  element: string | null;
  sentiment: string | null;
  tone: string | null;
  sector_impact: string[];
  reference_stocks: string[];
}

export const NAKSHATRAS: NakshatraRow[] = (table as { nakshatras: NakshatraRow[] }).nakshatras;
export const NAKSHATRA_TABLE_IS_PLACEHOLDER = "_note" in (table as object);

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const SPAN = 360 / 27; // 13°20'

/**
 * Lahiri (Chitrapaksha) ayanamsa in degrees. 23°51'11" at J2000.0, advancing with
 * general precession (~50.29"/yr). Within ~0.01° of published values for 1950–2050.
 */
export function lahiriAyanamsa(date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525; // Julian centuries from J2000
  const precessionArcsec = 5028.796195 * T + 1.1054348 * T * T;
  return 23.85305 + precessionArcsec / 3600;
}

export function moonTropicalLongitude(date: Date): number {
  return Astronomy.EclipticGeoMoon(date).lon; // true ecliptic of date
}

export interface MoonNakshatra {
  nakId: number;
  nakName: string;
  pada: number;
  moonSign: string;
  moonSiderealLon: number;
  ayanamsa: number;
}

export function nakshatraFromSiderealLon(lon: number) {
  const l = ((lon % 360) + 360) % 360;
  const idx = Math.floor(l / SPAN);
  const pada = Math.floor((l - idx * SPAN) / (SPAN / 4)) + 1;
  return { nakId: idx + 1, pada, moonSign: SIGNS[Math.floor(l / 30)], lon: l };
}

export function moonNakshatra(date: Date): MoonNakshatra {
  const ayanamsa = lahiriAyanamsa(date);
  const sid = moonTropicalLongitude(date) - ayanamsa;
  const n = nakshatraFromSiderealLon(sid);
  return { nakId: n.nakId, nakName: NAKSHATRAS[n.nakId - 1].name, pada: n.pada, moonSign: n.moonSign, moonSiderealLon: n.lon, ayanamsa };
}

export interface NakshatraSnapshot {
  nak_id: number;
  nak_name: string;
  nak_pada: number | null;
  moon_sign: string | null;
  moon_sidereal_lon: number | null;
  ruling_planet: string | null;
  zodiac: string | null;
  element: string | null;
  sentiment: string | null;
  tone: string | null;
  sector_impact: string[];
  reference_match: boolean;
  sector_match: boolean;
  nak_source: "auto" | "manual";
}

/** The snapshot stored on every signal and copied to the paper trade at entry. */
export function snapshotFor(date: Date, ticker: string, sector: string, manualNakId?: number | null): NakshatraSnapshot {
  const auto = moonNakshatra(date);
  const id = manualNakId ?? auto.nakId;
  const row = NAKSHATRAS[id - 1];
  return {
    nak_id: id,
    nak_name: row.name,
    nak_pada: manualNakId ? null : auto.pada,
    moon_sign: auto.moonSign,
    moon_sidereal_lon: Math.round(auto.moonSiderealLon * 100) / 100,
    ruling_planet: row.ruling_planet,
    zodiac: row.zodiac,
    element: row.element,
    sentiment: row.sentiment,
    tone: row.tone,
    sector_impact: row.sector_impact,
    reference_match: row.reference_stocks.includes(ticker.toUpperCase()),
    // Word match, so the client's "Large Cap Tech" counts for a Tech symbol and "Cloud Infra" for Cloud.
    sector_match: !!sector && row.sector_impact.some((s) => { const a = s.toLowerCase(), b = sector.toLowerCase(); return a === b || a.split(/[\s/]+/).includes(b) || b.split(/[\s/]+/).includes(a); }),
    nak_source: manualNakId ? "manual" : "auto",
  };
}
