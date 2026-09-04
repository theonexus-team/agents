"""Talks to the Theonexus dashboard's execution endpoints. See
src/app/api/execution/pending/route.ts and src/app/api/execution/report/route.ts."""

from __future__ import annotations

import logging

import requests

import config

log = logging.getLogger("ninjatrader-executor.client")


def fetch_pending() -> list[dict]:
    res = requests.get(
        f"{config.API_BASE_URL}/api/execution/pending",
        params={"secret": config.EXECUTION_SECRET},
        timeout=15,
    )
    res.raise_for_status()
    return res.json().get("intents", [])


def report_fill(intent_id: str, fill_price: float, outcome: str | None = None) -> dict:
    body = {"secret": config.EXECUTION_SECRET, "intentId": intent_id, "fillPrice": fill_price}
    if outcome:
        body["outcome"] = outcome
    res = requests.post(f"{config.API_BASE_URL}/api/execution/report", json=body, timeout=15)
    res.raise_for_status()
    return res.json()
