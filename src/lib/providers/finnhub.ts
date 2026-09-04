/** Finnhub economic calendar — https://finnhub.io/docs/api/economic-calendar
 *
 * Replaced the Apify/ForexFactory scraper (see apify-forexfactory.ts, kept but no
 * longer called from the sync cron) as the primary source for EconomicEvent —
 * Apify hit its own monthly usage hard limit (2026-09-03) and, being a scraper
 * against a site with no real API, was always going to be more fragile than an
 * actual financial-data provider. Finnhub is a plain synchronous REST call (no
 * start-a-run-then-poll async dance needed), and FINNHUB_API_KEY was already
 * configured on Vercel from some earlier, unrelated integration — this just
 * started using a key/provider that already existed.
 */

import { prisma } from "@/lib/prisma";

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

export async function getUpcomingEconEvents(daysAhead = 1): Promise<EconEvent[]> {
  if (daysAhead === 1 && cache && Date.now() - cache.at < CACHE_MS) return cache.events;

  const from = new Date();
  const to = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
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

const SYNC_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // re-sync at most once/hour

/**
 * Pulls a week ahead (matching the old Apify "this_week" scope) and replaces
 * EconomicEvent wholesale, then stamps EconCalendarSync.lastSuccessAt — the same
 * bookkeeping /risk-watchdog reads for staleness, so that page doesn't need to know
 * or care which provider is behind it. Called from BOTH the risk-watchdog cron
 * heartbeat (daily, browser-independent) AND the main dashboard's poll (every 15s
 * while a tab is open) — the hourly gate here is what keeps the latter from hitting
 * Finnhub's API and rewriting EconomicEvent on every single poll. Unlike the old
 * Apify version, this is a plain synchronous call with no separate "is a run already
 * in flight" state to track, so the gate is just a straight time check.
 */
export async function syncEconCalendarFromFinnhub(): Promise<void> {
  if (!finnhubConfigured()) return;

  const sync = await prisma.econCalendarSync.findUnique({ where: { id: "singleton" } });
  if (sync?.lastSuccessAt && Date.now() - sync.lastSuccessAt.getTime() < SYNC_REFRESH_INTERVAL_MS) return;

  const events = await getUpcomingEconEvents(7);

  await prisma.$transaction([
    prisma.economicEvent.deleteMany({}),
    prisma.economicEvent.createMany({
      data: events.map((e) => ({ title: e.title, country: e.country, releaseAt: new Date(e.releaseAt), tagged: e.tagged })),
    }),
    prisma.econCalendarSync.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", status: "idle", lastSuccessAt: new Date() },
      update: { status: "idle", apifyRunId: null, lastSuccessAt: new Date() },
    }),
  ]);
}
