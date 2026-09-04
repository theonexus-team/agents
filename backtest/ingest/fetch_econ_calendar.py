"""Pulls HISTORICAL high-impact USD economic calendar events via the same Apify
actor (scrapemint/forexfactory-economic-calendar) the live dashboard uses for its
"upcoming this week" panel — but that live path deliberately only ever requests
range="this_week" (a Vercel Hobby 10s function timeout constraint: range="custom"
is measured ~10-11s, right at the cap). That constraint doesn't apply here — this
runs as a one-off local script, not a serverless request — so this calls the same
actor directly with an explicit historical date range instead.

Cost: ~$0.015/row after the first 2 free rows per run (Apify actor pricing) — a
24-day window of high-impact USD events is typically a few dozen rows, well under
$1. Writes a small local JSON cache (backtest/data/econ_events_cache.json) keyed by
date range so repeat runs against the same window don't re-spend credits.
"""

from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ACTOR_ID = "scrapemint~forexfactory-economic-calendar"
CACHE_PATH = Path(__file__).resolve().parents[1] / "data" / "econ_events_cache.json"


def _api_call(url: str, method: str = "GET", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_historical_high_impact_usd(token: str, start_date: str, end_date: str) -> list[dict]:
    """start_date/end_date: "YYYY-MM-DD". Returns [{title, releaseAt (ISO), impact}]."""
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    cache_key = f"{start_date}_{end_date}"
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text())
        if cache_key in cache:
            return cache[cache_key]
    else:
        cache = {}

    events: list[dict] = []
    last_note = None
    for attempt in range(4):  # ForexFactory's calendar page 403s datacenter IPs
        # intermittently on the custom-range (real-browser) path; the actor's own
        # docs say retrying the same input "often succeeds."
        run = _api_call(
            f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs?token={token}",
            method="POST",
            body={
                "range": "custom",
                "startDate": start_date,
                "endDate": end_date,
                "impactLevels": ["high"],
                "currencies": ["USD"],
            },
        )
        run_id = run["data"]["id"]

        dataset_id = None
        for _ in range(30):  # up to ~60s
            status = _api_call(f"https://api.apify.com/v2/actor-runs/{run_id}?token={token}")
            state = status["data"]["status"]
            if state == "SUCCEEDED":
                dataset_id = status["data"]["defaultDatasetId"]
                break
            if state in ("FAILED", "ABORTED", "TIMED-OUT"):
                raise RuntimeError(f"Apify run {run_id} ended with status {state}")
            time.sleep(2)
        if dataset_id is None:
            raise RuntimeError(f"Apify run {run_id} did not finish in time")

        items = _api_call(f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={token}")
        if items and items[0].get("blocked"):
            last_note = items[0].get("note")
            time.sleep(5)
            continue

        events = [
            {"title": e["title"], "releaseAt": e["timestamp"], "impact": e["impact"]}
            for e in items
            if e.get("impact") == "high"
        ]
        break
    else:
        raise RuntimeError(f"ForexFactory kept blocking after 4 attempts: {last_note}")

    cache[cache_key] = events
    CACHE_PATH.write_text(json.dumps(cache, indent=2))
    return events


if __name__ == "__main__":
    import os
    import sys

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    token = os.environ["APIFY_API_TOKEN"]
    start, end = sys.argv[1], sys.argv[2]
    events = fetch_historical_high_impact_usd(token, start, end)
    print(f"{len(events)} high-impact USD event(s) between {start} and {end}:")
    for e in sorted(events, key=lambda e: e["releaseAt"]):
        print(f"  {e['releaseAt']}  {e['title']}")
