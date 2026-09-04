/** Finnhub economic calendar — https://finnhub.io/docs/api/economic-calendar */

export type EconEvent = {
  title: string;
  country: string;
  releaseAt: string;
  tagged: boolean;
};

type FinnhubEvent = {
  event: string;
  country: string;
  time: string; // "YYYY-MM-DD HH:mm:ss" UTC
  impact: "low" | "medium" | "high";
};

let cache: { at: number; events: EconEvent[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export function finnhubConfigured(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export async function getUpcomingEconEvents(): Promise<EconEvent[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.events;

  const from = new Date();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/economic?from=${fmt(from)}&to=${fmt(to)}&token=${process.env.FINNHUB_API_KEY}`
  );
  if (!res.ok) {
    throw new Error(`Finnhub calendar request failed (${res.status})`);
  }
  const data = (await res.json()) as { economicCalendar?: FinnhubEvent[] };

  const events = (data.economicCalendar ?? [])
    .map((e) => ({
      title: e.event,
      country: e.country,
      releaseAt: new Date(`${e.time}Z`).toISOString(),
      tagged: e.impact === "high",
    }))
    .filter((e) => {
      const t = new Date(e.releaseAt).getTime();
      return t >= from.getTime() && t <= to.getTime();
    })
    .sort((a, b) => (a.releaseAt < b.releaseAt ? -1 : 1));

  cache = { at: Date.now(), events };
  return events;
}
