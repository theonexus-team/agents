/**
 * ForexFactory economic calendar via the Apify actor scrapemint/forexfactory-economic-calendar.
 * Paid per-row (~$0.015/row, first 2 free per run). High-impact USD only, per user request.
 *
 * IMPORTANT: use named ranges (this_week/today/etc), never range:"custom" — custom
 * triggers the actor's slow headless-browser path (measured ~10-11s, right at/over
 * Vercel Hobby's 10s function cap) AND its impact-level filter doesn't get honored
 * correctly on that path (verified: returned medium-impact events despite
 * impactLevels:["high"]). Named ranges use the fast public-JSON-feed path instead
 * (measured ~3s) where filters work correctly.
 *
 * Kept on the async run pattern (kick off, poll separately) anyway as a safety net —
 * still cheap, and protects against any future slowness. See
 * src/app/api/dashboard/route.ts for the opportunistic kick-off/poll wiring.
 */

import { prisma } from "@/lib/prisma";

const ACTOR_ID = "scrapemint~forexfactory-economic-calendar";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-scrape at most every 6h

export function apifyConfigured(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

async function startRun(): Promise<string> {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${process.env.APIFY_API_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      range: "this_week",
      impactLevels: ["high"],
      currencies: ["USD"],
    }),
  });
  if (!res.ok) throw new Error(`Apify run start failed (${res.status})`);
  const data = await res.json();
  return data.data.id as string;
}

type RunStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTED" | "TIMED-OUT";

async function checkRun(runId: string): Promise<{ status: RunStatus; datasetId: string | null }> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${process.env.APIFY_API_TOKEN}`);
  if (!res.ok) throw new Error(`Apify run status check failed (${res.status})`);
  const data = await res.json();
  return { status: data.data.status, datasetId: data.data.defaultDatasetId ?? null };
}

type ForexFactoryEvent = {
  title: string;
  currency: string;
  timestamp: string;
  impact: "high" | "medium" | "low" | "holiday";
};

async function fetchDatasetItems(datasetId: string): Promise<ForexFactoryEvent[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_API_TOKEN}`
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed (${res.status})`);
  return res.json();
}

/**
 * Opportunistically advances the async sync state machine by one step (fast, <10s):
 * - no run tracked + stale/never synced -> kick off a new run
 * - run tracked + still running -> check status
 * - run tracked + succeeded -> pull dataset, upsert into EconomicEvent, clear tracking
 * Call this from a request path that also serves cached DB data regardless of outcome.
 */
export async function advanceEconCalendarSync(): Promise<void> {
  if (!apifyConfigured()) return;

  const state = await prisma.econCalendarSync.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  if (state.status === "running" && state.apifyRunId) {
    const { status, datasetId } = await checkRun(state.apifyRunId);
    if (status === "SUCCEEDED" && datasetId) {
      const items = await fetchDatasetItems(datasetId);
      const events = items
        .map((e) => ({
          title: e.title,
          country: e.currency,
          releaseAt: new Date(e.timestamp),
          tagged: e.impact === "high",
        }))
        .filter((e) => !Number.isNaN(e.releaseAt.getTime()));

      await prisma.$transaction([
        prisma.economicEvent.deleteMany({}),
        prisma.economicEvent.createMany({ data: events }),
        prisma.econCalendarSync.update({
          where: { id: "singleton" },
          data: { status: "idle", apifyRunId: null, lastSuccessAt: new Date() },
        }),
      ]);
    } else if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      await prisma.econCalendarSync.update({
        where: { id: "singleton" },
        data: { status: "idle", apifyRunId: null },
      });
    }
    // else still running — nothing to do, check again next call
    return;
  }

  const dueForRefresh =
    !state.lastSuccessAt || Date.now() - state.lastSuccessAt.getTime() > REFRESH_INTERVAL_MS;
  if (state.status === "idle" && dueForRefresh) {
    const runId = await startRun();
    await prisma.econCalendarSync.update({
      where: { id: "singleton" },
      data: { status: "running", apifyRunId: runId, startedAt: new Date() },
    });
  }
}
