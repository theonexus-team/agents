import { DateTime } from "luxon";

export type SessionKey = "TOKYO" | "SHANGHAI" | "LONDON" | "NEW_YORK";

export const SESSIONS: Record<
  SessionKey,
  { label: string; zone: string; openHour: number; openMinute: number }
> = {
  TOKYO: { label: "Tokyo", zone: "Asia/Tokyo", openHour: 9, openMinute: 0 },
  SHANGHAI: { label: "Shanghai", zone: "Asia/Shanghai", openHour: 9, openMinute: 30 },
  LONDON: { label: "London", zone: "Europe/London", openHour: 8, openMinute: 0 },
  NEW_YORK: { label: "New York", zone: "America/New_York", openHour: 9, openMinute: 30 },
};

/** Next session open, skipping weekends, as an ISO timestamp. */
export function nextSessionOpen(session: SessionKey, from: DateTime = DateTime.utc()): DateTime {
  const { zone, openHour, openMinute } = SESSIONS[session];
  let candidate = from.setZone(zone).set({
    hour: openHour,
    minute: openMinute,
    second: 0,
    millisecond: 0,
  });

  if (candidate <= from.setZone(zone)) {
    candidate = candidate.plus({ days: 1 });
  }

  while (candidate.weekday === 6 || candidate.weekday === 7) {
    candidate = candidate.plus({ days: 1 });
  }

  return candidate;
}

export function allNextOpens(from: DateTime = DateTime.utc()) {
  return (Object.keys(SESSIONS) as SessionKey[]).map((key) => ({
    session: key,
    label: SESSIONS[key].label,
    opensAt: nextSessionOpen(key, from).toUTC().toISO(),
  }));
}

/**
 * Start of the current futures trading day: 6pm ET to 5pm ET the next day. If it's
 * currently on/after 6pm ET, the trading day started today at 6pm; otherwise
 * (including the 5-6pm ET daily close window) it started yesterday at 6pm.
 */
export function tradingDayStart(from: DateTime = DateTime.utc()): DateTime {
  const ny = from.setZone("America/New_York");
  let start = ny.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  if (ny.hour < 18) {
    start = start.minus({ days: 1 });
  }
  return start.toUTC();
}
