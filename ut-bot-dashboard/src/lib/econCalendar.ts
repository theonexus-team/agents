/**
 * Economic calendar (Forex Factory weekly feed, no account). Cached 30 min.
 * News filter (spec defaults): USD only; High impact blocks NEW entries (BUY) from
 * 10 min before to 10 min after the event; Medium is shown and tagged but never blocks.
 * Exits (SELL, window end) always go through.
 */
const FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
export const BLACKOUT_MIN = 10;

export type EconEvent = { title: string; country: string; at: number; impact: "High" | "Medium" | "Low" | "Holiday"; forecast: string; previous: string; actual?: string };
const g = globalThis as unknown as { __utEcon?: { at: number; data: EconEvent[] } };

export async function getEvents(): Promise<{ source: "forexfactory" | "none"; events: EconEvent[] }> {
  if (g.__utEcon && Date.now() - g.__utEcon.at < 30 * 60_000) return { source: "forexfactory", events: g.__utEcon.data };
  try {
    const r = await fetch(FEED, { headers: { "user-agent": "ut-bot-dashboard" }, cache: "no-store" });
    if (!r.ok) throw new Error(`feed ${r.status}`);
    const raw = (await r.json()) as { title: string; country: string; date: string; impact: EconEvent["impact"]; forecast?: string; previous?: string; actual?: string }[];
    const events = raw.filter((e) => e.country === "USD").map((e) => ({ title: e.title, country: e.country, at: new Date(e.date).getTime(), impact: e.impact, forecast: e.forecast ?? "", previous: e.previous ?? "", actual: e.actual }));
    g.__utEcon = { at: Date.now(), data: events };
    return { source: "forexfactory", events };
  } catch (e) {
    console.error("econ feed", (e as Error).message);
    // Keep serving the last good copy if we have one.
    return g.__utEcon ? { source: "forexfactory", events: g.__utEcon.data } : { source: "none", events: [] };
  }
}

/** News state at a moment: blackout (High within ±10 min), medium_nearby, or clear; plus the nearest event. */
export async function newsStateAt(t: Date) {
  const { events } = await getEvents();
  const win = BLACKOUT_MIN * 60_000;
  const near = events.filter((e) => (e.impact === "High" || e.impact === "Medium") && Math.abs(e.at - t.getTime()) <= win).sort((a, b) => Math.abs(a.at - t.getTime()) - Math.abs(b.at - t.getTime()));
  const high = near.find((e) => e.impact === "High");
  const ev = high ?? near[0];
  return {
    news_state: (high ? "blackout" : near.length ? "medium_nearby" : "clear") as "blackout" | "medium_nearby" | "clear",
    nearest_event: ev?.title ?? null,
    minutes_to_event: ev ? Math.round((ev.at - t.getTime()) / 60_000) : null,
  };
}

/** Today's USD High/Medium events in New York time, for the dashboard panel. */
export async function todaysEvents(now = new Date()) {
  const { events, source } = await getEvents();
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const today = events.filter((e) => key(new Date(e.at)) === key(now) && (e.impact === "High" || e.impact === "Medium")).sort((a, b) => a.at - b.at);
  return {
    source,
    rows: today.map((e) => ({
      time: new Date(e.at).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }),
      impact: e.impact,
      title: e.title,
      detail: `A ${e.actual || "–"} · F ${e.forecast || "–"} · P ${e.previous || "–"}`,
      state: e.at <= now.getTime() ? "Released" : "upcoming",
    })),
  };
}
