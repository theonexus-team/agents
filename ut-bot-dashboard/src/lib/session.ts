/**
 * NY session logic shared by the timer, the paper engine and the push filter.
 * Everything is computed in America/New_York so DST never shifts the windows.
 */
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const NY_TZ = "America/New_York";

/** NYSE full closures. Verify yearly against nyse.com/markets/hours-calendars. */
export const MARKET_HOLIDAYS: string[] = [
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
];

/** 1:00 PM ET early closes. The indicator's fixed 3–4 PM power hour never fires on these days. */
export const EARLY_CLOSES: string[] = ["2026-11-27", "2026-12-24", "2027-11-26"];

const MIN = 60_000;
const PRE_START = 7 * 60; // pre-market monitoring + trading window starts 7:00 AM ET
const OPEN = 9 * 60 + 30;
const OPENING_END = 11 * 60;
const POWER_START = 15 * 60;
const CLOSE = 16 * 60;
const EARLY_CLOSE = 13 * 60;

export type Phase = "pre" | "premarket" | "opening" | "midday" | "power" | "closed";
export type TradingWindow = "pre_market" | "opening" | "midday" | "power_hour" | null;

/** Paper trades run continuously 7:00 AM–3:00 PM ET (pre-market, opening, midday); power hour is logged only. */
export const TRADEABLE_WINDOWS = ["pre_market", "opening", "midday"] as const;
export const isTradeableWindow = (w: string | null | undefined) => !!w && (TRADEABLE_WINDOWS as readonly string[]).includes(w);

export interface SessionState {
  phase: Phase;
  /** a window where alerts are live and paper trades open */
  window: TradingWindow;
  alertsLive: boolean;
  earlyClose: boolean;
  /** ms until the current phase ends (or until next open when closed) */
  msLeft: number;
  /** UTC instant of the next opening bell (only meaningful when pre/closed) */
  nextOpen: Date;
  label: string;
  /** 0–1 progress across 7:00–16:00 (clamped) for the timer bar */
  dayProgress: number;
}

export function nyDateKey(d: Date): string {
  return formatInTimeZone(d, NY_TZ, "yyyy-MM-dd");
}

export function isTradingDay(d: Date): boolean {
  const z = toZonedTime(d, NY_TZ);
  const dow = z.getDay();
  if (dow === 0 || dow === 6) return false;
  return !MARKET_HOLIDAYS.includes(nyDateKey(d));
}

export function isEarlyClose(d: Date): boolean {
  return EARLY_CLOSES.includes(nyDateKey(d));
}

function nyMinutes(d: Date): number {
  const z = toZonedTime(d, NY_TZ);
  return z.getHours() * 60 + z.getMinutes() + z.getSeconds() / 60 + z.getMilliseconds() / 60000;
}

function atNy(dateKey: string, minutes: number): Date {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${dateKey}T${h}:${m}:00`, NY_TZ);
}

export function nextOpenAfter(d: Date): Date {
  // Start from today's NY calendar date; walk forward until a trading day whose open is after d.
  const key = nyDateKey(d);
  let probe = atNy(key, OPEN);
  for (let i = 0; i < 15; i++) {
    if (isTradingDay(probe) && probe.getTime() > d.getTime()) return probe;
    probe = atNy(nyDateKey(new Date(probe.getTime() + 24 * 3600_000)), OPEN);
  }
  return probe;
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MIN));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return `${days}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getSessionState(now: Date = new Date()): SessionState {
  const key = nyDateKey(now);
  const trading = isTradingDay(now);
  const early = trading && isEarlyClose(now);
  const close = early ? EARLY_CLOSE : CLOSE;
  const mins = nyMinutes(now);
  const nextOpen = nextOpenAfter(now);
  const dayProgress = Math.min(1, Math.max(0, (mins - PRE_START) / (CLOSE - PRE_START)));
  const until = (m: number) => atNy(key, m).getTime() - now.getTime();

  const closedState = (): SessionState => {
    const z = toZonedTime(nextOpen, NY_TZ);
    const sameDay = nyDateKey(nextOpen) === key;
    const day = formatInTimeZone(nextOpen, NY_TZ, "EEE");
    return {
      phase: "closed",
      window: null,
      alertsLive: false,
      earlyClose: early,
      msLeft: nextOpen.getTime() - now.getTime(),
      nextOpen,
      label: sameDay ? `NY opens in ${fmtDuration(nextOpen.getTime() - now.getTime())}` : `Market closed — monitoring resumes ${day} 7:00 AM ET`,
      dayProgress: z && trading && mins >= close ? 1 : 0,
    };
  };

  if (!trading) return closedState();

  if (mins < PRE_START) {
    const ms = until(PRE_START);
    return { phase: "pre", window: null, alertsLive: false, earlyClose: early, msLeft: ms, nextOpen, label: `Pre-market monitoring starts 7:00 AM ET (in ${fmtDuration(ms)})`, dayProgress: 0 };
  }
  if (mins < OPEN) {
    const ms = until(OPEN);
    return { phase: "premarket", window: "pre_market", alertsLive: true, earlyClose: early, msLeft: ms, nextOpen, label: `PRE-MARKET — NY opens in ${fmtDuration(ms)}`, dayProgress };
  }
  if (mins < OPENING_END) {
    const ms = until(OPENING_END);
    return { phase: "opening", window: "opening", alertsLive: true, earlyClose: early, msLeft: ms, nextOpen, label: `OPENING SESSION — ${fmtDuration(ms)} left`, dayProgress };
  }
  if (early) {
    if (mins < EARLY_CLOSE) {
      const ms = until(EARLY_CLOSE);
      return { phase: "midday", window: "midday", alertsLive: true, earlyClose: true, msLeft: ms, nextOpen, label: `Early close — trading until 1:00 PM ET (${fmtDuration(ms)} left)`, dayProgress };
    }
    return { ...closedState(), label: `Early close — market closed · opens ${formatInTimeZone(nextOpen, NY_TZ, "EEE")} 9:30 AM ET` };
  }
  if (mins < POWER_START) {
    const ms = until(POWER_START);
    return { phase: "midday", window: "midday", alertsLive: true, earlyClose: false, msLeft: ms, nextOpen, label: `MIDDAY — trading until 3:00 PM (${fmtDuration(ms)} left)`, dayProgress };
  }
  if (mins < CLOSE) {
    const ms = until(CLOSE);
    return { phase: "power", window: null, alertsLive: false, earlyClose: false, msLeft: ms, nextOpen, label: `POWER HOUR — not traded (closes in ${fmtDuration(ms)})`, dayProgress };
  }
  return closedState();
}

/** Which window (if any) a 2m bar-close instant falls into. Used to tag signals and gate paper trades. */
export function windowAt(d: Date): "pre_market" | "opening" | "power_hour" | "midday" | "outside" {
  if (!isTradingDay(d)) return "outside";
  const m = nyMinutes(d);
  const early = isEarlyClose(d);
  // Matches the indicator: TradingView puts a bar in a session by its OPEN time,
  // so by close time the windows are (start, end]: 9:32–11:00 and 15:02–16:00.
  if (m > PRE_START && m <= OPEN) return "pre_market"; // bars 7:00–9:30 (by open time) → close 7:02–9:30
  if (m > OPEN && m <= OPENING_END) return "opening";
  if (!early && m > POWER_START && m <= CLOSE) return "power_hour";
  if (m > OPENING_END && m <= (early ? EARLY_CLOSE : POWER_START)) return "midday";
  return "outside";
}

/** End of the trading day (ET): 3:00 PM, or 1:00 PM on early-close days. Everything still open closes here. */
export function windowEnds(d: Date): Date[] {
  if (!isTradingDay(d)) return [];
  const key = nyDateKey(d);
  return [atNy(key, isEarlyClose(d) ? EARLY_CLOSE : POWER_START)];
}

export function fmtEt(d: Date, pattern = "h:mm a"): string {
  return formatInTimeZone(d, NY_TZ, pattern);
}
